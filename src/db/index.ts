import "server-only";
import path from "node:path";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * DATABASE_URL set  -> real Postgres (Neon / Supabase / any). Required on Vercel.
 * DATABASE_URL unset -> embedded PGlite in ./.data (local development only), migrated automatically.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __db?: Promise<DB> };

async function create(): Promise<DB> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });
    return drizzle(client, { schema }) as unknown as DB;
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add a Postgres database (e.g. Neon) in Vercel project settings.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__db) {
    g.__db = create().catch((e) => {
      g.__db = undefined;
      throw e;
    });
  }
  return g.__db;
}

export { schema };

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
