import { normalize } from "./library/text";

/**
 * Temas que AURA NUNCA trata (16-11-2026): cómo está construida la tienda (código, tecnologías, base de datos,
 * servidores, API, prompts, modelos) y cualquier tema de seguridad informática (vulnerabilidades, accesos,
 * contraseñas, claves, hackeo, panel de administración).
 *
 * Es una barrera determinista ANTES de la biblioteca y del modelo: la pregunta no llega a ningún modelo y la
 * respuesta es fija. Así no depende de que el modelo "obedezca" su prompt.
 *
 * Se evalúan frases sin tildes (normalize). Se busca intención técnica, no palabras sueltas: "¿el pago es
 * seguro?" o "¿cómo protegen mis datos?" siguen siendo preguntas válidas de un comprador.
 */
const PATTERNS: RegExp[] = [
  // Construcción de la tienda
  /\b(codigo fuente|source code|repositorio|github|gitlab|commit|branch|rama del codigo)\b/,
  /\b(pagina|tienda|web|sitio|app|aplicacion|aura|chat|bot)\b.{0,30}\b(programad[ao]|hech[ao]|construid[ao]|desarrollad[ao])\b/,
  /\b(programad[ao]|construid[ao]|desarrollad[ao])\b.{0,30}\b(pagina|tienda|web|sitio|app|aplicacion|aura|chat|bot)\b/,
  /\b(que|cual|cuales)\b.{0,25}\b(lenguaje de programacion|framework|stack)\b/,
  /\btecnologias? (usan|usaron|utilizan|utilizaron|tiene la (pagina|tienda|web))\b/,
  /\b(next ?js|react|typescript|javascript|node ?js|prisma|supabase|vercel|postgres(ql)?|sql|tailwind|zustand|zod|wompi api|webhook|endpoint|api key|apikey|backend|frontend|servidor|hosting|base de datos|database|docker|kubernetes)\b/,
  /\b(prompt|instrucciones del sistema|system prompt|que modelo( de ia)? (eres|usas)|que (ia|inteligencia artificial) (eres|usas)|gemini|ollama|qwen|llm|chatgpt|openai|anthropic|claude)\b/,
  // Seguridad informática
  /\b(hack\w*|vulnerab\w*|exploit\w*|inyeccion|injection|xss|csrf|ddos|phishing|malware|bypass|fuerza bruta|brute ?force|pentest\w*|token|cookie|sesion de administrador|jwt)\b/,
  /\b(panel (de )?admin\w*|administrador del sitio|acceso (de |al )?admin\w*|\/admin|credencial\w*|contrasena del (admin|administrador|sistema|servidor)|clave (secreta|privada|de api)|secret)\b/,
  /\b(como (entrar|acceder|ingresar) (al|a la) (panel|sistema|servidor|base)|saltar(me)? la seguridad|desactivar la seguridad|robar datos|datos de otros clientes)\b/,
  /\b(variables? de entorno|env file|\.env|cron|rls|row level security|cifrado|encriptacion|hash de contrasena|algoritmo de seguridad)\b/,
];

export function isRestrictedTopic(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return PATTERNS.some((p) => p.test(t));
}

export const RESTRICTED_REPLY =
  "Esa información es interna de 7H STORE y no la comparto por seguridad. Con gusto te ayudo con productos, pedidos, pagos, envíos, devoluciones o garantías. Si es un tema técnico de tu compra, el equipo te atiende por WhatsApp o en Contacto.";
