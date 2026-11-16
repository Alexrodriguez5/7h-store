import { correct, normalize, stem, tokens } from "./library/text";

/**
 * Búsqueda de productos tolerante para AURA (BUG-05). Antes se exigía que TODAS las palabras aparecieran
 * literalmente y con las mismas tildes ("camara" no encontraba "Cámara"). Ahora:
 * - compara sin tildes ni mayúsculas y por raíz ("zapatillas" ↔ "zapatilla");
 * - corrige errores de escritura contra el vocabulario del propio catálogo;
 * - basta con que coincida la mayoría de las palabras, y se ordena por relevancia.
 * Es determinista y local: el catálogo es pequeño, así que se filtra en memoria.
 */
export interface SearchableProduct {
  name: string;
  brand: string;
  description?: string | null;
  tags?: string[];
  category: { label: string };
  color?: string | null;
  model?: string | null;
}

const fieldsOf = (p: SearchableProduct) => ({
  strong: normalize([p.name, p.brand, p.model ?? "", p.category.label, ...(p.tags ?? [])].join(" ")),
  weak: normalize([p.description ?? "", p.color ?? ""].join(" ")),
});

const stems = (text: string) => new Set(text.split(" ").filter(Boolean).map(stem));

export function rankProducts<T extends SearchableProduct>(query: string, products: T[], limit = 6): T[] {
  const indexed = products.map((p) => {
    const f = fieldsOf(p);
    return { p, strong: stems(f.strong), weak: stems(f.weak) };
  });
  const vocab = new Set<string>();
  for (const i of indexed) for (const w of i.strong) if (w.length >= 4) vocab.add(w);

  const words = [...new Set(tokens(query).map((w) => correct(stem(w), vocab)))].slice(0, 6);
  if (!words.length) return [];
  const needed = Math.max(1, Math.ceil(words.length / 2));

  return indexed
    .map(({ p, strong, weak }, order) => {
      let hits = 0, score = 0;
      for (const w of words) {
        if (strong.has(w)) { hits++; score += 3; }
        else if (weak.has(w)) { hits++; score += 1; }
      }
      return { p, hits, score, order };
    })
    .filter((r) => r.hits >= needed)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.p);
}
