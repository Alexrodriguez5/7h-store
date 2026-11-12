/**
 * Envío del pedido desde el navegador, sin esperas infinitas (BUG-02) y sin duplicados (BUG-03).
 *
 * - Cada intento de compra lleva una clave (`attemptKey`) que se guarda en sessionStorage junto a la huella
 *   del intento. Una recarga o un reintento reutilizan la clave; si cambia el carrito, el correo o el medio
 *   de pago, se genera otra.
 * - La petición tiene tiempo máximo. Si se agota o se cae la red NO se asume que el pedido no existe:
 *   se pregunta al servidor por esa clave antes de dejar reintentar.
 * - Reintentar es seguro: el servidor devuelve el mismo pedido para la misma clave.
 */

export interface AttemptStorage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const STORE_KEY = "7h-order-attempt";
export const ORDER_TIMEOUT_MS = 30_000;
const VERIFY_TIMEOUT_MS = 8_000;

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

/** Huella del intento en el navegador (no es un secreto): decide si se reutiliza la clave. */
export function attemptFingerprint(p: { email: string; paymentMethod: string; items: { productId: string; size?: string; quantity: number }[] }) {
  return JSON.stringify([p.email.trim().toLowerCase(), p.paymentMethod, p.items.map((i) => `${i.productId}:${i.size ?? ""}:${i.quantity}`).sort()]);
}

/** Clave del intento actual: la misma mientras no cambie la huella. Si el almacenamiento falla, sirve solo para esta carga. */
export function attemptKeyFor(fingerprint: string, storage: AttemptStorage | null): string {
  try {
    const saved = storage ? (JSON.parse(storage.getItem(STORE_KEY) ?? "null") as { key?: string; fp?: string } | null) : null;
    if (saved?.key && saved.fp === fingerprint && /^[A-Za-z0-9_-]{16,64}$/.test(saved.key)) return saved.key;
  } catch { /* dato corrupto: se genera otra clave */ }
  const key = newKey();
  try { storage?.setItem(STORE_KEY, JSON.stringify({ key, fp: fingerprint })); } catch { /* modo privado */ }
  return key;
}

export function clearAttempt(storage: AttemptStorage | null) {
  try { storage?.removeItem(STORE_KEY); } catch { /* nada que limpiar */ }
}

export type SubmitResult =
  | { kind: "ok"; publicCode: string; redirectUrl?: string }
  /** El servidor respondió y rechazó el pedido (sin stock, datos inválidos…). No se creó nada. */
  | { kind: "rejected"; message: string; status: number }
  /** No hubo respuesta y el servidor tampoco confirma un pedido con esta clave. Reintentar es seguro. */
  | { kind: "unknown"; reason: "timeout" | "network" };

interface Deps { fetchImpl?: typeof fetch; timeoutMs?: number; verifyTries?: number; verifyDelayMs?: number; onVerifying?: () => void }

const readOrder = (body: unknown): { publicCode: string; redirectUrl?: string } | null => {
  if (typeof body !== "object" || !body) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.publicCode !== "string") return null;
  return { publicCode: b.publicCode, redirectUrl: typeof b.redirectUrl === "string" ? b.redirectUrl : undefined };
};

const withTimeout = (ms: number) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

/** Pregunta si ya existe un pedido para esta clave. null = el servidor dice que no; undefined = no se pudo saber. */
export async function findAttempt(key: string, fetchImpl: typeof fetch = fetch): Promise<{ publicCode: string; redirectUrl?: string } | null | undefined> {
  const t = withTimeout(VERIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`/api/orders?intento=${encodeURIComponent(key)}`, { signal: t.signal, cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return readOrder(await res.json()) ?? undefined;
  } catch {
    return undefined;
  } finally {
    t.done();
  }
}

export async function submitOrder(payload: Record<string, unknown> & { attemptKey: string }, deps: Deps = {}): Promise<SubmitResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const t = withTimeout(deps.timeoutMs ?? ORDER_TIMEOUT_MS);
  let reason: "timeout" | "network" = "network";
  try {
    const res = await fetchImpl("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: t.signal });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) {
      const order = readOrder(body);
      if (order) return { kind: "ok", ...order };
    } else if (res.status < 500) {
      const message = typeof body === "object" && body && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "No pudimos crear el pedido.";
      return { kind: "rejected", message, status: res.status };
    }
    // 5xx o respuesta ilegible: el pedido pudo haberse creado. Se verifica abajo.
  } catch {
    reason = t.signal.aborted ? "timeout" : "network";
  } finally {
    t.done();
  }

  // Sin respuesta confiable: antes de permitir otro intento se consulta el estado real en el servidor.
  deps.onVerifying?.();
  const tries = deps.verifyTries ?? 3;
  for (let i = 0; i < tries; i++) {
    const found = await findAttempt(payload.attemptKey, fetchImpl);
    if (found) return { kind: "ok", ...found };
    if (i < tries - 1) await new Promise((r) => setTimeout(r, deps.verifyDelayMs ?? 2_000));
  }
  return { kind: "unknown", reason };
}
