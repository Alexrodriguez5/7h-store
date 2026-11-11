import { z } from "zod";

/**
 * Reglas de campos de 7H STORE en UN solo lugar: las usan los formularios (mientras se escribe y al enviar)
 * y las API (validación real en el servidor). Si cambias una regla aquí, cambia en todas partes.
 *
 * Dos piezas por tipo de campo:
 * - `sanitize(kind, valor)`: limpia lo que se escribe o se pega SIN inventar datos. Quita solo caracteres que ese
 *   campo no admite y avisa (`rejected`) para mostrar un mensaje; los separadores de formato (espacios o guiones
 *   en un celular, puntos de miles en un precio) se quitan sin aviso porque no cambian el dato.
 * - esquemas Zod (`personName`, `coMobile`, `documentFields`…): deciden si el dato es válido. El servidor los
 *   aplica siempre, aunque alguien envíe la solicitud saltándose el formulario.
 */

export const MSG = {
  digits: "Este campo solo permite números.",
  phone: "Introduce un número de celular colombiano válido (10 dígitos, empieza por 3).",
  phoneAny: "Introduce un número de teléfono válido (celular de 10 dígitos o fijo 60X).",
  phoneChars: "El teléfono solo admite números y el prefijo +57.",
  doc: "El documento contiene caracteres no permitidos.",
  name: "El nombre solo admite letras, espacios, guiones y apóstrofes.",
  email: "Verifica el formato del correo electrónico.",
  emailSpaces: "El correo no lleva espacios.",
  quantity: "La cantidad debe ser un número entero mayor que cero.",
  money: "Escribe solo el valor en pesos, sin letras.",
  city: "La ciudad solo admite letras y espacios.",
  address: "La dirección contiene caracteres no permitidos.",
  postal: "El código postal en Colombia tiene 6 dígitos.",
} as const;

export const DOCUMENT_TYPES = ["CC", "CE", "NIT", "PASAPORTE"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Formato de cada documento colombiano admitido. El pasaporte es alfanumérico (no todos los documentos son números). */
export const DOCUMENT_RULES: Record<DocumentType, { re: RegExp; chars: RegExp; max: number; message: string; numeric: boolean }> = {
  // Cédula de ciudadanía: 5 a 10 dígitos (las antiguas son más cortas).
  CC: { re: /^\d{5,10}$/, chars: /\d/, max: 10, numeric: true, message: "La cédula de ciudadanía tiene entre 5 y 10 dígitos." },
  // Cédula de extranjería: 6 a 10 dígitos.
  CE: { re: /^\d{6,10}$/, chars: /\d/, max: 10, numeric: true, message: "La cédula de extranjería tiene entre 6 y 10 dígitos." },
  // NIT: 9 dígitos y, opcional, el dígito de verificación (900123456 o 900123456-7).
  NIT: { re: /^\d{9}(-?\d)?$/, chars: /[\d-]/, max: 11, numeric: true, message: "El NIT tiene 9 dígitos y, si quieres, el dígito de verificación (900123456-7)." },
  // Pasaporte: letras y números, 5 a 20 caracteres.
  PASAPORTE: { re: /^[A-Z0-9]{5,20}$/, chars: /[A-Za-z0-9]/, max: 20, numeric: false, message: "El pasaporte tiene entre 5 y 20 letras o números." },
};

export type FieldKind = "digits" | "quantity" | "money" | "phone" | "name" | "email" | "city" | "address" | "postal" | `doc:${DocumentType}`;

const NAME_CHAR = /[\p{L}\p{M}\s'’.-]/u;
const CITY_CHAR = /[\p{L}\p{M}\s.'-]/u;
// Direcciones colombianas (urbanas y rurales): "Cra. 7 # 45-10 apto 301", "Vereda El Roble, finca N.º 2".
const ADDRESS_CHAR = /[\p{L}\p{M}\p{N}\s#.,:;\-/°ºª()'’&+]/u;
const ADDRESS_RE = /^[\p{L}\p{M}\p{N}\s#.,:;\-/°ºª()'’&+]+$/u;

export interface Sanitized { value: string; rejected: string | null }

/** Deja solo los caracteres que `keep` admite; los que `silent` admite se quitan sin aviso (son formato, no datos). */
function filter(raw: string, keep: (c: string) => boolean, silent: (c: string) => boolean, message: string): Sanitized {
  let out = "", rejected = false;
  for (const c of raw) {
    if (keep(c)) out += c;
    else if (!silent(c)) rejected = true;
  }
  return { value: out, rejected: rejected ? message : null };
}

/** Limpia un valor mientras se escribe o al pegarlo. Nunca agrega ni reordena caracteres válidos. */
export function sanitize(kind: FieldKind, raw: string): Sanitized {
  if (kind.startsWith("doc:")) {
    const rule = DOCUMENT_RULES[kind.slice(4) as DocumentType] ?? DOCUMENT_RULES.CC;
    const r = filter(raw, (c) => rule.chars.test(c), (c) => /[\s.]/.test(c), MSG.doc);
    return { value: (rule.numeric ? r.value : r.value.toUpperCase()).slice(0, rule.max), rejected: r.rejected };
  }
  switch (kind) {
    case "digits":
    case "quantity":
      return filter(raw, (c) => /\d/.test(c), (c) => /\s/.test(c), kind === "quantity" ? MSG.quantity : MSG.digits);
    case "money":
      // "1.500.000", "$ 1,500,000" o "1500000" → "1500000". Pesos colombianos: sin decimales.
      return filter(raw, (c) => /\d/.test(c), (c) => /[\s.,$]/.test(c), MSG.money);
    case "phone": {
      // Solo dígitos y un "+" al inicio. Espacios, guiones y paréntesis son formato: se quitan sin aviso.
      const r = filter(raw, (c) => /[\d+]/.test(c), (c) => /[\s\-().]/.test(c), MSG.phoneChars);
      const plus = r.value.startsWith("+");
      const digits = r.value.replace(/\+/g, "");
      const moved = r.value.slice(1).includes("+");
      return { value: (plus ? `+${digits}` : digits).slice(0, plus ? 16 : 10), rejected: r.rejected ?? (moved ? MSG.phoneChars : null) };
    }
    case "postal":
      return filter(raw, (c) => /\d/.test(c), (c) => /\s/.test(c), MSG.postal);
    case "name":
      return filter(raw, (c) => NAME_CHAR.test(c), () => false, MSG.name);
    case "city":
      return filter(raw, (c) => CITY_CHAR.test(c), () => false, MSG.city);
    case "address":
      return filter(raw, (c) => ADDRESS_CHAR.test(c), () => false, MSG.address);
    case "email":
      return filter(raw, (c) => !/\s/.test(c), () => false, MSG.emailSpaces);
  }
  return { value: raw, rejected: null };
}

/** Atributos de teclado y autocompletado por tipo (teclado numérico en celular, etc.). */
export function inputAttrs(kind: FieldKind): { inputMode?: "numeric" | "tel" | "email" | "text"; autoComplete?: string; maxLength?: number; pattern?: string; spellCheck?: boolean } {
  if (kind.startsWith("doc:")) {
    const rule = DOCUMENT_RULES[kind.slice(4) as DocumentType] ?? DOCUMENT_RULES.CC;
    return { inputMode: rule.numeric ? "numeric" : "text", autoComplete: "off", maxLength: rule.max, spellCheck: false };
  }
  switch (kind) {
    case "digits": case "quantity": return { inputMode: "numeric", pattern: "[0-9]*" };
    case "money": return { inputMode: "numeric" };
    case "phone": return { inputMode: "tel", autoComplete: "tel", maxLength: 20 };
    case "postal": return { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" };
    case "email": return { inputMode: "email", autoComplete: "email", spellCheck: false };
    case "name": return { autoComplete: "name" };
    case "city": return { autoComplete: "address-level2" };
    case "address": return { autoComplete: "street-address" };
  }
  return {};
}

// ── Esquemas para servidor y formularios ───────────────────────────────

/** Quita caracteres de control (salvo saltos de línea y tabulaciones) que no tienen lugar en un texto. */
export const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export const personName = (min = 2, max = 120, required = "Escribe tu nombre") =>
  z.string().trim().min(min, required).max(max, "Nombre demasiado largo").regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u, MSG.name);

export const emailField = z.string().trim().toLowerCase().max(254, "Correo demasiado largo").pipe(z.email(MSG.email));

/** Normaliza un celular: quita espacios/guiones y el prefijo +57 (o 57 antes de los 10 dígitos). */
export const normalizePhone = (v: string) => {
  const d = v.replace(/[\s\-().]/g, "");
  return d.startsWith("+57") ? d.slice(3) : /^57\d{10}$/.test(d) ? d.slice(2) : d;
};

/** Celular colombiano: 10 dígitos que empiezan por 3. Acepta +57 delante. */
export const coMobile = z.string().trim().transform(normalizePhone).pipe(z.string().regex(/^3\d{9}$/, MSG.phone));
/** Celular o fijo colombiano (fijo: 60 + indicativo + número, 10 dígitos). */
export const coPhone = z.string().trim().transform(normalizePhone).pipe(z.string().regex(/^(3\d{9}|60\d{8})$/, MSG.phoneAny));
/** Opcional: vacío se guarda como null. */
export const optionalMobile = z.string().trim().max(20).optional().or(z.literal("")).transform((v) => (v ? normalizePhone(v) : null)).refine((v) => v === null || /^3\d{9}$/.test(v), MSG.phone);
export const optionalPhone = z.string().trim().max(20).optional().or(z.literal("")).transform((v) => (v ? normalizePhone(v) : null)).refine((v) => v === null || /^(3\d{9}|60\d{8})$/.test(v), MSG.phoneAny);

/** Teléfono opcional nacional o internacional (+ y 7 a 15 dígitos, formato E.164). +57 se guarda sin prefijo. */
export const optionalIntlPhone = z.string().trim().max(24).optional().or(z.literal("")).transform((v) => { if (!v) return null; const d = v.replace(/[\s\-().]/g, ""); return /^\+57\d{10}$/.test(d) ? d.slice(3) : d; }).refine((v) => v === null || /^(3\d{9}|60\d{8}|\+[1-9]\d{6,14})$/.test(v), MSG.phoneAny);

/** Valida el número según el tipo de documento elegido (normaliza puntos y espacios, y el pasaporte a mayúsculas). */
export function checkDocument(type: DocumentType, raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const rule = DOCUMENT_RULES[type];
  const value = raw.replace(/[\s.]/g, "");
  const v = rule.numeric ? value : value.toUpperCase();
  return rule.re.test(v) ? { ok: true, value: v } : { ok: false, message: rule.message };
}

/** Par tipo + número de documento, para usar dentro de un z.object con .superRefine. */
export function refineDocument<T extends { documentType: DocumentType; documentNumber: string }>(v: T, ctx: z.RefinementCtx) {
  const r = checkDocument(v.documentType, v.documentNumber);
  if (!r.ok) ctx.addIssue({ code: "custom", path: ["documentNumber"], message: r.message });
}

export const quantity = (max: number) => z.number({ error: MSG.quantity }).int(MSG.quantity).min(1, MSG.quantity).max(max, `Máximo ${max} unidades`);
export const moneyCOP = (max = 200_000_000) => z.number({ error: "Valor no válido" }).int("Los pesos no llevan decimales").min(0, "El valor no puede ser negativo").max(max, "Valor demasiado alto");
export const coPostalCode = z.string().trim().regex(/^\d{6}$/, MSG.postal);
export const cityName = z.string().trim().min(2, "Escribe la ciudad").max(80).regex(/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u, MSG.city);
export const addressText = (min = 6, max = 200) => z.string().trim().min(min, "Escribe una dirección válida").max(max, "Dirección demasiado larga").regex(ADDRESS_RE, MSG.address);
/** Texto libre: signos de puntuación normales permitidos, sin caracteres de control, con límite de longitud. */
export const freeText = (max: number, min = 0, required = "Este campo es obligatorio") => z.string().transform(stripControl).pipe(z.string().trim().min(min, required).max(max, `Máximo ${max} caracteres`));
