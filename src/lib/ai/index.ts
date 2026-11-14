import "server-only";
import { z } from "zod";

/**
 * Structured-JSON generation with provider fallback:
 *   1. Gemini on Vertex AI (primary)
 *   2. Groq free tier (fallback)
 * Set AI_PROVIDER=mock to use deterministic fake output (local development / tests without keys).
 */

export type ProviderName = "gemini-vertex" | "groq" | "mock";

export interface GenerateOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  /** Used when AI_PROVIDER=mock. */
  mock: () => T;
}

export class AiUnavailableError extends Error {}

const TIMEOUT_MS = 55_000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return schema.parse(JSON.parse(cleaned));
}

// ---------- Gemini (Vertex AI) ----------

function geminiConfigured() {
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

function serviceAccountCredentials(): Record<string, unknown> | undefined {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined; // fall back to Application Default Credentials (e.g. `gcloud auth application-default login`)
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

async function callGemini<T>(o: GenerateOptions<T>): Promise<T> {
  const { GoogleGenAI } = await import("@google/genai");
  const credentials = serviceAccountCredentials();
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    ...(credentials
      ? { googleAuthOptions: { credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] } }
      : {}),
  });
  const res = await withTimeout(
    ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: o.prompt,
      config: {
        systemInstruction: o.system,
        temperature: o.temperature ?? 0.4,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(o.schema, { target: "draft-7" }),
      },
    }),
    "Gemini",
  );
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return parseJson(text, o.schema);
}

// ---------- Groq (OpenAI-compatible) ----------

function groqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroq<T>(o: GenerateOptions<T>): Promise<T> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(o.schema, { target: "draft-7" }));
  const res = await withTimeout(
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: o.temperature ?? 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${o.system}\n\nRespond with a single JSON object that conforms to this JSON Schema:\n${jsonSchema}`,
          },
          { role: "user", content: o.prompt },
        ],
      }),
    }),
    "Groq",
  );
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response");
  return parseJson(text, o.schema);
}

// ---------- Public API ----------

export function aiStatus(): { primary: ProviderName | null; fallback: ProviderName | null } {
  if (process.env.AI_PROVIDER === "mock") return { primary: "mock", fallback: null };
  return {
    primary: geminiConfigured() ? "gemini-vertex" : null,
    fallback: groqConfigured() ? "groq" : null,
  };
}

export async function generateJson<T>(o: GenerateOptions<T>): Promise<{ data: T; provider: ProviderName }> {
  if (process.env.AI_PROVIDER === "mock") return { data: o.schema.parse(o.mock()), provider: "mock" };

  const errors: string[] = [];
  if (geminiConfigured()) {
    try {
      return { data: await callGemini(o), provider: "gemini-vertex" };
    } catch (e) {
      errors.push(`Gemini: ${(e as Error).message}`);
      console.error("[ai] Gemini failed, falling back to Groq:", e);
    }
  }
  if (groqConfigured()) {
    try {
      return { data: await callGroq(o), provider: "groq" };
    } catch (e) {
      errors.push(`Groq: ${(e as Error).message}`);
      console.error("[ai] Groq failed:", e);
    }
  }
  if (errors.length === 0) {
    throw new AiUnavailableError(
      "No AI provider configured. Set GOOGLE_CLOUD_PROJECT (+ GOOGLE_SERVICE_ACCOUNT_JSON) for Gemini and/or GROQ_API_KEY.",
    );
  }
  throw new AiUnavailableError(`All AI providers failed. ${errors.join(" | ")}`);
}
