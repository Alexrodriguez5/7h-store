/**
 * URL de conexión para la app en ejecución.
 * En Vercel cada instancia del servidor abre su propio grupo de conexiones. Con el "Session pooler" de Supabase
 * (puerto 5432, máximo 15 clientes) eso agota el límite y aparece "max clients reached". Por eso, en Vercel:
 * - se usa el "Transaction pooler" del mismo servidor (puerto 6543, pensado para serverless) con pgbouncer=true;
 * - cada instancia usa 1 conexión (connection_limit=1).
 * Los comandos de Prisma (db push) siguen usando DATABASE_URL tal cual.
 */
export function runtimeDatabaseUrl(raw: string | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const serverless = Boolean(env.VERCEL);
    if (serverless && u.hostname.endsWith(".pooler.supabase.com") && u.port === "5432") {
      u.port = "6543";
      u.searchParams.set("pgbouncer", "true");
    }
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", serverless ? "1" : "5");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return raw;
  }
}
