# CA Prep Tracker

Track what a CA student studies, and **prove they understood it**. Every study entry is treated as a *claim*. The app immediately generates a short ICAI-style test on exactly what was logged. Topics only count as **Understood** after a test score of 70% or more, and they come back for spaced re-tests (3 → 7 → 21 → 45 → 90 days).

Supports multiple students. Each student picks their CA level, group and attempt. Right now the **CA Intermediate Group II** syllabus is loaded (P4 Costing, P5 Audit, P6A FM, P6B SM).

## What it does

- **Log a session**: topics from the syllabus tree, session type (first read, revision, practice), source (ICAI SM / RTP / MTP / past papers / coaching), exact items covered, duration, practice score, a **summary in the student's own words**, confidence (1–5) and doubts.
- **Understanding check**: right after logging, AI writes 5 questions (case-based MCQs, numericals with different figures, descriptive mini cases) and reviews the summary. MCQs and numericals are marked in code. Descriptive answers are marked by AI against an examiner-style rubric.
- **Mastery per topic**: *Not started → Studied (claimed) → Understood / Weak → Re-test due*.
- **Dashboard**: claimed vs understood coverage per paper, exam countdown, hours vs target, streak, re-tests due, **over-confidence flags** (felt 4–5/5 but scored under 60%), open doubts.
- **Syllabus map**: every topic with hours, revisions, last score and confidence. Tick topics and run a self-test.

## Stack

Next.js 16 (App Router, server actions) · Postgres via Drizzle ORM · Tailwind · AI: **Gemini on Vertex AI**, falling back to **Groq free tier** (`llama-3.3-70b-versatile`).

## Local development

```bash
npm install
cp .env.example .env.local     # set AI_PROVIDER=mock to try it without any keys
npm run dev
```

With no `DATABASE_URL`, an embedded Postgres (PGlite) is created in `./.data` and migrated automatically.

```bash
npm test          # unit tests
npm run typecheck
```

## Deploy to Vercel (free)

1. **Import** this repo in Vercel. The framework is detected automatically. The `vercel-build` script runs database migrations, then `next build`.
2. **Database**: in the Vercel project, open *Storage → Marketplace → Neon (free)* and connect it. This sets `DATABASE_URL`. Supabase Postgres also works if you paste its connection string.
3. **Session secret**: add `SESSION_SECRET` (`openssl rand -base64 32`).
4. **Gemini (Vertex AI)**:
   - In Google Cloud, enable the *Vertex AI API* on your project.
   - Create a service account with the role **Vertex AI User** and create a JSON key.
   - In Vercel, set `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global` and `GOOGLE_SERVICE_ACCOUNT_JSON` (paste the JSON, or base64 of it). Optionally set `GEMINI_MODEL` (default `gemini-2.5-flash`).
5. **Groq fallback**: create a free key at console.groq.com and set `GROQ_API_KEY`. Optionally set `GROQ_MODEL`.
6. Deploy, then open the site and sign up as the student.

*Settings* shows which AI providers are active. If Gemini fails (quota, outage, invalid output), the request is retried on Groq automatically.

## Adding more syllabi

Add a file like `src/syllabus/ca-inter-group1.ts` and register it in `src/syllabus/index.ts` (`"intermediate:group1": ...`). Topic ids are derived from names, so don't rename topics students have already logged against. Add new ones instead.

## Caveats

- AI-generated answer keys can be wrong, especially numericals. Students can tick *"This question looks wrong"* to exclude a question from scoring. Worked solutions are shown after submission.
- The topic breakdown follows the ICAI study material chapter list. Verify it against the current ICAI module for your attempt.
