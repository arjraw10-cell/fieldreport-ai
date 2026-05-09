export function getDatabaseProviderInfo() {
  return {
    provider: process.env.DATABASE_URL ? "postgres-via-database-url" : "local-memory-fallback",
    insforgeConfigured: Boolean(process.env.INSFORGE_API_KEY),
    note: process.env.DATABASE_URL
      ? "DATABASE_URL is the InsForge-backed Postgres path for this MVP."
      : "No DATABASE_URL was provided, so the localhost demo uses an in-process database fallback."
  };
}
