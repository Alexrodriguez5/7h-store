/**
 * URL de conexión para la app en ejecución.
 *
 * En Vercel se usa el "Transaction pooler" de Supabase (puerto 6543, pgbouncer=true), pensado para serverless:
 * muchas conexiones de cliente comparten pocas conexiones reales de PostgreSQL.
 *
 * Conexiones por instancia (BUG-01): con 1 sola, las peticiones simultáneas de una misma instancia y las páginas
 * que lanzan varias consultas a la vez hacían fila y fallaban a los 20 s ("Timed out fetching a new connection").
 * Ahora son 3 por instancia, ajustables con DATABASE_CONNECTION_LIMIT (1 a 5).
 * Cuenta que justifica el 3: el pooler del plan gratuito admite 200 clientes; con 3 por instancia caben ~66
 * instancias a la vez. Con 5 serían 40, sin beneficio medible para este tráfico. No subirlo sin revisar ese límite.
 *
 * pool_timeout 10 s: si no hay conexión libre se falla pronto (y la página usa su caché) en vez de acumular espera.
 * connect_timeout 10 s: una base lenta en responder no deja la petición colgada.
 * Los comandos de Prisma (migrate) siguen usando DATABASE_URL tal cual.
 */
const clamp = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function runtimeDatabaseUrl(raw: string | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const serverless = Boolean(env.VERCEL);
    if (serverless && u.hostname.endsWith(".pooler.supabase.com") && u.port === "5432") {
      u.port = "6543";
      u.searchParams.set("pgbouncer", "true");
    }
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", String(serverless ? clamp(env.DATABASE_CONNECTION_LIMIT, 3, 1, 5) : 5));
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", serverless ? "10" : "20");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10");
    return u.toString();
  } catch {
    return raw;
  }
}
