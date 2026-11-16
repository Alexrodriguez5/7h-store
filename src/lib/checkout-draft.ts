/**
 * Borrador del checkout (BUG-08): si el cliente recarga la página o el envío falla, no pierde lo escrito.
 *
 * Protección de datos:
 * - sessionStorage (solo esta pestaña; se borra al cerrarla), nunca localStorage ni cookies.
 * - Lista blanca de campos: NO se guardan el número de documento, los términos aceptados ni nada de pagos.
 *   Las tarjetas, el CVV y las credenciales nunca pasan por este formulario (los maneja Wompi).
 * - Caduca a las 2 horas y se borra al crear el pedido.
 */
export const CHECKOUT_DRAFT_KEY = "7h-checkout-draft";
const VERSION = 1;
const TTL_MS = 2 * 60 * 60 * 1000;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const FIELDS = {
  customer: ["fullName", "email", "phone", "documentType"],
  shipping: ["department", "city", "address", "neighborhood", "notes"],
} as const;
const PAYMENT = ["card", "pse", "bank_transfer", "cash_deposit"] as const;

export interface CheckoutDraft {
  customer: Partial<Record<(typeof FIELDS.customer)[number], string>>;
  shipping: Partial<Record<(typeof FIELDS.shipping)[number], string>>;
  paymentMethod?: (typeof PAYMENT)[number];
}

const pick = <K extends string>(src: unknown, keys: readonly K[]) => {
  const out: Partial<Record<K, string>> = {};
  if (!src || typeof src !== "object") return out;
  for (const k of keys) {
    const v = (src as Record<string, unknown>)[k];
    if (typeof v === "string" && v.length <= 500) out[k] = v;
  }
  return out;
};

/** Reduce cualquier objeto (valores del formulario o lo leído del almacenamiento) a los campos permitidos. */
export function sanitizeDraft(values: unknown): CheckoutDraft {
  const v = (values ?? {}) as Record<string, unknown>;
  const pm = v.paymentMethod;
  return {
    customer: pick(v.customer, FIELDS.customer),
    shipping: pick(v.shipping, FIELDS.shipping),
    ...(typeof pm === "string" && (PAYMENT as readonly string[]).includes(pm) ? { paymentMethod: pm as CheckoutDraft["paymentMethod"] } : {}),
  };
}

const isEmpty = (d: CheckoutDraft) => !Object.values(d.customer).some(Boolean) && !Object.values(d.shipping).some(Boolean);

export function saveDraft(values: unknown, store: Storage | null, now = Date.now()) {
  if (!store) return;
  const draft = sanitizeDraft(values);
  try {
    if (isEmpty(draft)) store.removeItem(CHECKOUT_DRAFT_KEY);
    else store.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ v: VERSION, at: now, draft }));
  } catch {
    /* almacenamiento lleno o bloqueado: el checkout sigue funcionando sin borrador */
  }
}

export function loadDraft(store: Storage | null, now = Date.now()): CheckoutDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; at?: number; draft?: unknown };
    if (parsed.v !== VERSION || typeof parsed.at !== "number" || now - parsed.at > TTL_MS || parsed.at > now + 60_000) {
      store.removeItem(CHECKOUT_DRAFT_KEY);
      return null;
    }
    const d = sanitizeDraft(parsed.draft);
    return isEmpty(d) ? null : d;
  } catch {
    return null;
  }
}

export function clearDraft(store: Storage | null) {
  try {
    store?.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    /* sin efecto */
  }
}
