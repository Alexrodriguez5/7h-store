/**
 * Texto para la biblioteca de AURA: normalización, palabras vacías, sinónimos (conceptos) y tolerancia a
 * errores ortográficos. Todo es determinista y local: no usa IA ni servicios externos.
 */

/** minúsculas, sin tildes ni signos, espacios simples. "¿Cuánto VALE el envío?" → "cuanto vale el envio" */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a al algo algun alguna alguno ante como con cual cuales cuando de del desde donde e el ella ellos en entre era es esa ese eso esta este esto estoy ha hay la las le les lo los me mi mis muy nos o para pero por que se si sin sobre su sus te ti tu tus un una uno unos unas y ya yo usted ustedes ustedes favor porfa porfavor hola buenas buenos dias tardes noches gracias quisiera quiero queria podria puedo puede pueden saber necesito ser fue hacer tengo tienen tiene tienes van va voy seria sera hace cosa cosas ok vale bien todo toda todos todas aca aqui alla esto algo alguien mucho poco cuentame cuenteme cuentenme contar explicame explicar dime digame".split(" "),
);
// "vale" y "tiene(n)" son palabras vacías salvo en contexto de precio/stock; el precio lo detecta el concepto "costo".
STOP.delete("vale");

/**
 * Conceptos: palabras distintas que significan lo mismo para un comprador. La clave es el concepto; los
 * valores son raíces (se compara por prefijo después de normalizar). Agregar aquí mejora a toda la biblioteca.
 */
export const CONCEPTS: Record<string, string[]> = {
  envio: ["envio", "envia", "enviar", "domicilio", "transporte", "flete", "despach", "mandar", "mandan", "llevar", "llevan", "traer", "traen", "llega", "llegar", "recibir", "recibo", "entrega", "entregan", "transportadora", "mensajeria", "shipping"],
  costo: ["cost", "cuesta", "cuestan", "vale", "valor", "precio", "cobra", "cobran", "pagar", "pago", "tarifa", "gratis", "gratuito", "incluido", "incluye", "plata", "flete"],
  tiempo: ["tiempo", "tarda", "demora", "demoran", "cuando", "dias", "dia", "plazo", "rapido", "pronto", "semana", "horas"],
  cobertura: ["ciudad", "ciudades", "departamento", "municipio", "pueblo", "region", "colombia", "nacional", "cobertura", "bogota", "medellin", "cali", "barranquilla"],
  pago: ["pago", "pagar", "pagos", "tarjeta", "credito", "debito", "pse", "wompi", "transferencia", "consignacion", "efectivo", "nequi", "daviplata", "bancolombia", "medio", "metodo", "forma"],
  devolucion: ["devol", "devuelv", "retracto", "retract", "reembolso", "reembols", "cambio", "cambiar", "regresar", "arrepent", "cancelar", "dinero"],
  garantia: ["garantia", "defecto", "defectuoso", "danado", "dano", "roto", "falla", "fallo", "malo"],
  reclamo: ["reclamo", "reclamar", "pqr", "queja", "quejar", "peticion", "radic"],
  compra: ["compra", "comprar", "compro", "pedir", "pido", "ordenar", "adquirir", "carrito", "checkout", "proceso", "pasos", "realiz", "hago", "hacer pedido"],
  cuenta: ["cuenta", "registr", "registro", "usuario", "perfil", "login", "ingresar", "entrar", "sesion", "contrasena", "clave", "invitado"],
  pedido: ["pedido", "orden", "compra"],
  seguimiento: ["seguimiento", "rastre", "rastrear", "guia", "estado", "donde", "va", "ubicar", "seguir", "track"],
  busqueda: ["busqueda", "buscan", "buscar", "consigu", "conseguir", "traer", "encarg", "importar", "pedido especial", "especial", "personalizad", "no esta", "no aparece", "no encuentro", "solicitud", "solicitar", "cotiz"],
  tienda: ["tienda", "7h", "store", "empresa", "negocio", "quienes", "dedica", "manejan", "venden", "vende", "clase", "tipo"],
  confianza: ["confiable", "confianza", "confiar", "estafa", "seguro", "segura", "legal", "serio", "seria", "robar", "roben", "fraude", "miedo"],
  impuesto: ["impuesto", "iva", "impuestos", "pesos", "cop", "colombianos"],
  humano: ["asesor", "persona", "humano", "agente", "whatsapp", "llamar", "telefono", "contacto", "contact", "hablar", "comunic", "escribir"],
  talla: ["talla", "tallas", "medida", "medidas", "numero", "size", "horma"],
  reserva: ["reserva", "reservan", "aparta", "apartar", "separar", "guardan", "guardar", "unidades", "vence", "vencer", "expira"],
};

/** Raíz → concepto, para buscar rápido. Una raíz puede pertenecer a varios conceptos (p. ej. "pago"). */
const ROOTS: [string, string][] = Object.entries(CONCEPTS).flatMap(([c, roots]) => roots.filter((r) => !r.includes(" ")).map((r) => [r, c] as [string, string]));
const PHRASES: [string, string][] = Object.entries(CONCEPTS).flatMap(([c, roots]) => roots.filter((r) => r.includes(" ")).map((r) => [r, c] as [string, string]));

/** Quita plurales simples: "envios" → "envio", "tallas" → "talla", "devoluciones" → "devolucion". */
export function stem(w: string) {
  let x = w;
  if (x.length > 5 && x.endsWith("ones")) x = x.slice(0, -2);
  else if (x.length > 4 && x.endsWith("es") && !x.endsWith("ees")) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith("s")) x = x.slice(0, -1);
  // Raíz de 6 letras: une conjugaciones y derivados ("registrarme"/"registro" → "regist", "rastrear"/"rastreo" → "rastre").
  return x.length > 6 ? x.slice(0, 6) : x;
}

export function tokens(s: string) {
  return normalize(s).split(" ").filter((w) => w && !STOP.has(w));
}

/** Distancia de edición (Levenshtein) con corte temprano. */
export function editDistance(a: string, b: string, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const tolerance = (w: string) => (w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0);

/**
 * Corrige una palabra contra un vocabulario conocido ("enbio" → "envio", "debolucion" → "devolucion").
 * Solo si la palabra no está en el vocabulario y hay UNA corrección clara.
 */
export function correct(w: string, vocab: Set<string>) {
  if (vocab.has(w) || w.length < 4 || /\d/.test(w)) return w;
  // Sustituciones fonéticas frecuentes en español escrito rápido.
  const phon = w.replace(/b/g, "v").replace(/z/g, "s").replace(/ll/g, "y").replace(/^h/, "");
  for (const v of vocab) if (v.replace(/b/g, "v").replace(/z/g, "s").replace(/ll/g, "y").replace(/^h/, "") === phon) return v;
  let best = w, bestD = tolerance(w) + 1, ties = 0;
  for (const v of vocab) {
    if (Math.abs(v.length - w.length) > 2) continue;
    const d = editDistance(w, v, tolerance(w));
    if (d < bestD) { best = v; bestD = d; ties = 0; } else if (d === bestD) ties++;
  }
  return bestD <= tolerance(w) && ties === 0 ? best : w;
}

/** Conceptos presentes en un texto (por raíz y por frase). */
export function conceptsOf(words: string[], normalizedText: string) {
  const out = new Set<string>();
  // Raíces cortas (pse, iva, dia) solo cuentan si la palabra es exactamente esa; las largas, por prefijo.
  for (const w of words) for (const [r, c] of ROOTS) if (r.length < 4 ? w === r : w.startsWith(r) || (r.length >= 5 && w.length >= 5 && r.startsWith(w))) out.add(c);
  for (const [p, c] of PHRASES) if (normalizedText.includes(p)) out.add(c);
  return out;
}

/** Vocabulario base de conceptos (para la corrección ortográfica aunque la biblioteca esté vacía). */
export const CONCEPT_VOCAB = new Set(ROOTS.map(([r]) => r).filter((r) => r.length >= 4));
