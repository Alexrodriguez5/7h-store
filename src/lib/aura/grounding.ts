import { AiError, type AiProvider, type ProviderRun } from "./provider";

/**
 * Control de información comercial para modelos locales (Qwen en Ollama).
 *
 * Un modelo pequeño puede inventar plazos, precios, descuentos o garantías. Antes de entregar su respuesta se
 * revisa que CADA dato comercial con número (precios, días, porcentajes, meses, montos) aparezca en una fuente
 * oficial de 7H STORE de ese mismo turno: el prompt del sistema (políticas resumidas), los resultados de las
 * herramientas (catálogo y políticas) o la información aprobada de la biblioteca que viaja con la pregunta.
 * Si algún dato no tiene fuente, la respuesta se descarta y el turno pasa al respaldo (Gemini), que tiene las
 * mismas herramientas. Así el cliente nunca recibe un dato comercial inventado por el modelo local.
 *
 * Es deliberadamente estricto: descartar de más solo cuesta una llamada a Gemini; dejar pasar un dato falso
 * puede ser publicidad engañosa.
 */

/** Frases con contexto comercial donde un número es un compromiso con el cliente. */
const COMMERCIAL = /(\$|cop\b|peso|precio|cuesta|vale|valor|descuento|rebaja|oferta|promoci|%|por ciento|d[ií]as?\b|h[aá]bil|semana|mes(es)?\b|a[nñ]o|garant[ií]a|devoluci|retracto|reembolso|env[ií]o|entrega|llega|gratis|m[ií]nimo|m[aá]ximo|cuota|existencia|unidad|disponible|stock)/i;

/** Números tal como los escribe una persona: "539.000", "$ 1.199.000", "15", "2,5". Devuelve su valor canónico. */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d{1,3}(?:[.,\s]\d{3})+(?!\d)|\d+(?:[.,]\d+)?/g)) {
    let raw = m[0].replace(/\s/g, "");
    // Separadores de miles (539.000 / 1,199,000) → 539000. Decimales cortos (2,5) se conservan como 2.5.
    if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, "");
    else raw = raw.replace(",", ".");
    out.push(String(Number(raw)));
  }
  return out;
}

const sentences = (text: string) => text.split(/(?<=[.!?\n])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Datos comerciales con número que NO aparecen en las fuentes. Vacío = respuesta respaldada. */
export function unsupportedClaims(answer: string, sources: string[]): string[] {
  const known = new Set(sources.flatMap(numbersIn));
  const bad: string[] = [];
  for (const s of sentences(answer)) {
    if (!COMMERCIAL.test(s)) continue;
    const missing = numbersIn(s).filter((n) => !known.has(n));
    if (missing.length) bad.push(s.slice(0, 160));
  }
  return bad;
}

/** Palabras de descuento sin que ninguna fuente hable de descuentos: tampoco se aceptan. */
const DISCOUNT = /\b(descuento|rebaja|promoci[oó]n|cup[oó]n)\w*/i;
const NEGATED = /\b(no|sin|ning[uú]n|ninguna|nunca)\b[^.!?]{0,40}\b(descuento|rebaja|promoci[oó]n|cup[oó]n)/i;

export function inventsDiscount(answer: string, sources: string[]) {
  if (!DISCOUNT.test(answer) || NEGATED.test(answer)) return false;
  return !sources.some((s) => DISCOUNT.test(s));
}

/**
 * Envuelve un proveedor local: registra lo que las herramientas devolvieron y valida la respuesta final.
 * Si no está respaldada lanza AiError("unavailable") para que la cadena pase al respaldo.
 */
export function groundedProvider(inner: AiProvider, onReject?: (claims: string[]) => void): AiProvider {
  return {
    id: inner.id,
    async run(opts: ProviderRun) {
      const toolResults: string[] = [];
      const result = await inner.run({
        ...opts,
        execute: async (call) => {
          const out = await opts.execute(call);
          toolResults.push(JSON.stringify(out));
          return out;
        },
      });
      // Lo que escribe el cliente NO es fuente (podría pedir "un descuento del 50 %"); solo la información
      // aprobada que el servidor adjunta a su pregunta.
      const approved = opts.history.flatMap((t) => (t.role === "user" ? (t.text.match(/\[Información aprobada de 7H STORE[\s\S]*\]$/)?.[0] ?? []) : []));
      const official = [...approved, ...toolResults];
      const claims = unsupportedClaims(result.text, [opts.system, ...official]);
      // El prompt menciona descuentos solo para prohibirlos: para descuentos cuentan las herramientas y la biblioteca.
      if (inventsDiscount(result.text, official)) claims.push("menciona un descuento que ninguna fuente ofrece");
      if (claims.length) {
        onReject?.(claims);
        throw new AiError("unavailable", "Respuesta del modelo local sin fuente oficial", undefined, "datos comerciales sin respaldo");
      }
      return result;
    },
  };
}
