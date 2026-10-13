import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));

/** Parámetros scrypt: N=2^15, r=8, p=1 (~32 MB, ~100 ms). Se guardan junto al hash para poder subirlos en el futuro. */
const N = 32768, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

/** Comparación en tiempo constante (hashea ambos lados para igualar longitudes). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  // Límites para que un hash manipulado no pueda forzar un cálculo enorme.
  if (![n, r, p].every(Number.isInteger) || n < 1024 || n > 131072 || r < 1 || r > 16 || p < 1 || p > 4) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length < 8 || expected.length < 32) return false;
  const key = await scrypt(password.normalize("NFKC"), salt, expected.length, { N: n, r, p, maxmem: 128 * n * r * 2 });
  return timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;
/** Hash ficticio para que "usuario inexistente" tarde lo mismo que "contraseña incorrecta". */
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(12).toString("hex")));

/** Política mínima: 12+ caracteres, no igual al correo. Devuelve el error o null. */
export function passwordPolicyError(password: string, email?: string): string | null {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga.";
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "La contraseña no puede ser igual al correo.";
  if (/^(.)\1+$/.test(password)) return "La contraseña es demasiado simple.";
  return null;
}

/**
 * Llave de arranque: ADMIN_PASSWORD solo sirve para crear el PRIMER administrador en /admin/setup.
 * Después de eso ya no da acceso al panel.
 */
export function checkSetupKey(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
