import { describe, expect, it, vi } from "vitest";
import { importSeed } from "@/lib/aura/library/service";
import { SEED } from "@/lib/aura/library/seed";
import { EXTRA_VARIANTS } from "@/lib/aura/library/variants-extra";
import { normalize } from "@/lib/aura/library/text";

describe("formas adicionales de preguntar", () => {
  it("hay cientos y todas pertenecen a una respuesta aprobada existente", () => {
    const total = Object.values(EXTRA_VARIANTS).flat().length;
    expect(total).toBeGreaterThanOrEqual(200);
    for (const slug of Object.keys(EXTRA_VARIANTS)) expect(SEED.some((s) => s.slug === slug)).toBe(true);
  });

  it("importSeed agrega a las entradas existentes solo las variantes que faltan, como sintéticas", async () => {
    const createMany = vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
    const db = {
      knowledgeEntry: {
        findFirst: vi.fn(async () => ({ id: "e1", questions: SEED[0].variants.slice(0, 3).map((v) => ({ searchText: normalize(v) })) })),
      },
      knowledgeQuestion: { createMany },
    };
    const r = await importSeed("admin", db as never);
    expect(r.created).toBe(0);
    expect(r.skipped).toBe(SEED.length);
    expect(r.addedVariants).toBeGreaterThan(200);
    const first = createMany.mock.calls[0][0].data as { text: string; synthetic: boolean }[];
    expect(first.every((q) => q.synthetic)).toBe(true);
    expect(first.some((q) => q.text === SEED[0].variants[0])).toBe(false);
  });
});
