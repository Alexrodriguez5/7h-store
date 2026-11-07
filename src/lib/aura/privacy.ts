/**
 * Filtro de privacidad de AURA. Corre en el NAVEGADOR (para avisar antes de enviar) y en el SERVIDOR
 * (la decisión real). Mientras usemos el nivel gratuito de Gemini, Google puede usar lo que enviamos para
 * mejorar sus productos, así que ningún dato personal debe salir hacia el modelo.
 *
 * No depende de una sola expresión regular. Son cuatro capas:
 * 1. Diseño: la identidad del cliente (nombre, correo, cuenta, pedidos) nunca se arma en el prompt; el correo
 *    se pide en un campo de la aplicación, fuera del chat, y la solicitud se vincula en el servidor.
 * 2. Normalización: se quitan espacios, puntos y guiones entre dígitos, y se reconocen correos escritos
 *    "a mano" (arroba, punto com) antes de buscar patrones.
 * 3. Reglas por tipo de dato, con verificación (Luhn para tarjetas) y contexto (palabras como "cédula",
 *    "clave", "cuenta" antes de un número).
 * 4. Regla de último recurso: CUALQUIER secuencia larga de dígitos que no sea claramente un precio se oculta.
 *
 * Datos de alto riesgo (tarjeta, clave, cuenta bancaria, documento): el mensaje NO se envía al modelo.
 * Datos de contacto (correo, celular, dirección, nombre propio): se reemplazan por [dato omitido] y se avisa.
 */

export type PrivateKind = "correo" | "celular" | "documento" | "tarjeta" | "cuenta_bancaria" | "clave" | "direccion" | "nombre" | "pedido" | "token";

export const HIGH_RISK: readonly PrivateKind[] = ["tarjeta", "clave", "cuenta_bancaria", "documento", "token"];

export const KIND_LABEL: Record<PrivateKind, string> = {
  correo: "un correo", celular: "un número de teléfono", documento: "un número de documento", tarjeta: "un número de tarjeta",
  cuenta_bancaria: "datos bancarios", clave: "una contraseña o código", direccion: "una dirección", nombre: "un nombre propio",
  pedido: "un código de pedido", token: "un código o enlace privado",
};

export interface PrivacyResult { text: string; kinds: PrivateKind[]; block: boolean; urlCleaned: boolean }

const MASK = "[dato omitido]";

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Un número es "precio" si va con $, COP, pesos, mil, k o millones, o con puntos de miles. */
const PRICE_CONTEXT = /(\$\s*$|cop\s*$|presupuesto[^\d]{0,20}$|precio[^\d]{0,20}$|hasta[^\d]{0,6}$)/i;
const PRICE_AFTER = /^\s*(cop|pesos|mil|k\b|millones|m\b)/i;

export function scanPrivate(input: string): PrivacyResult {
  const kinds = new Set<PrivateKind>();
  let t = input.normalize("NFKC");

  const sub = (re: RegExp, kind: PrivateKind, rep: string | ((m: string, ...a: string[]) => string) = MASK) => {
    t = t.replace(re, (...args: string[]) => {
      kinds.add(kind);
      return typeof rep === "function" ? rep(...(args as [string, ...string[]])) : rep;
    });
  };

  // URLs: se conservan dominio y ruta (referencia del producto) pero nunca la consulta ni el fragmento,
  // que a menudo llevan tokens, correos o identificadores de sesión.
  // Quitar la consulta no bloquea el mensaje: lo que podía ser privado ya no está.
  let urlCleaned = false;
  t = t.replace(/\bhttps?:\/\/[^\s<>"']+/gi, (u) => {
    const clean = u.replace(/[?#].*$/, "");
    if (clean !== u) urlCleaned = true;
    return clean.length > 200 ? clean.slice(0, 200) : clean;
  });

  // Correos, incluso escritos "a mano".
  sub(/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\barroba\b)\s*[a-z0-9-]+(\s*(\.|\bpunto\b)\s*[a-z]{2,})+/gi, "correo");

  // Contraseñas, claves y códigos: la palabra y lo que sigue.
  sub(/\b(contrase(ñ|n)a|password|clave|pin|c(ó|o)digo de (verificaci(ó|o)n|seguridad)|otp|cvv|cvc|token)\b\s*(es|:|=|de)?\s*\S+/gi, "clave", "[clave omitida]");

  // Datos bancarios: banco o billetera + número.
  sub(/\b(cuenta( de)? (ahorros|corriente)?|n(ú|u)mero de cuenta|bancolombia|davivienda|nequi|daviplata|banco de bogot(á|a)|bbva|llave|iban)\b[^\d\n]{0,25}[\d\s.-]{6,}/gi, "cuenta_bancaria");

  // Documento con contexto.
  sub(/\b(c\.?\s?c\.?|c(é|e)dula|documento|nit|pasaporte|ti|tarjeta de identidad|ce)\b[^\d\n]{0,12}[\d.\s-]{5,14}\d/gi, "documento");

  // Pedidos de la tienda (información privada: se consulta en Mi cuenta, no en el chat).
  sub(/\b7H-[A-Z0-9]{6}\b/gi, "pedido");

  // Direcciones colombianas: "Calle 10 # 20-30", "Cra 7 No 45 - 12", "Av. 68 #10".
  sub(/\b(calle|cll|cl|carrera|cra|kr|cr|avenida|av|diagonal|dg|transversal|tv|autopista)\.?\s*\d+\s*[a-z]?\s*(bis)?\s*(#|no\.?|n°|nro\.?)\s*\d+\s*[a-z]?\s*-?\s*\d*/gi, "direccion");

  // Nombre propio presentado ("me llamo Ana María Pérez", "mi nombre es ...").
  sub(/\b(me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/g, "nombre", (_m, intro) => `${intro} ${MASK}`);

  // Tokens largos al azar (claves de API, enlaces de recuperación copiados sin URL).
  sub(/\b(?=[A-Za-z0-9_-]{24,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}\b/g, "token", "[código omitido]");

  // Secuencias de dígitos (con espacios, puntos o guiones en medio): tarjeta, celular o documento.
  t = t.replace(/\+?\d[\d\s.-]{5,}\d/g, (m, offset: number, whole: string) => {
    const digits = m.replace(/\D/g, "");
    const before = whole.slice(Math.max(0, offset - 24), offset);
    const after = whole.slice(offset + m.length, offset + m.length + 12);
    // Precio: "$ 3.500.000", "3500000 pesos", "presupuesto de 2.000.000". Se deja.
    if (PRICE_CONTEXT.test(before) || PRICE_AFTER.test(after)) return m;
    if (/^\d{1,3}(\.\d{3})+$/.test(m.trim()) && digits.length <= 10) return m; // 1.250.000: miles con punto
    if (/^\d{4,9}$/.test(m.trim()) && /000$/.test(digits)) return m; // 3500000: monto redondo sin formato
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) { kinds.add("tarjeta"); return "[tarjeta omitida]"; }
    if (/^(\+?57)?3\d{9}$/.test(digits) || /^(\+?57)?60\d{8}$/.test(digits)) { kinds.add("celular"); return MASK; }
    if (digits.length >= 7) { kinds.add("documento"); return MASK; }
    return m;
  });

  const list = [...kinds];
  return { text: t, kinds: list, block: list.some((k) => HIGH_RISK.includes(k)), urlCleaned };
}

/** Frase para el cliente: "Quité un correo y un número de teléfono de tu mensaje". */
export function describeKinds(kinds: PrivateKind[]) {
  const words = [...new Set(kinds)].map((k) => KIND_LABEL[k]);
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} y ${words.at(-1)}`;
}
