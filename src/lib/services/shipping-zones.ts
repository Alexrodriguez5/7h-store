import { unstable_cache, revalidateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COLOMBIA } from "@/data/colombia";
import type { ShippingZoneRule } from "@/lib/shipping";

export const TAG_SHIPPING = "shipping:zones";
const DEPARTMENTS = Object.keys(COLOMBIA);

const select = { name: true, departments: true, priceCOP: true, baseWeightGrams: true, extraPerKgCOP: true, minDays: true, maxDays: true } satisfies Prisma.ShippingZoneSelect;

/** Zonas activas (las que cobra la tienda), en caché hasta que el admin las cambie. Si la tabla aún no existe, devuelve []. */
export const getShippingZones = unstable_cache(
  async (): Promise<ShippingZoneRule[]> => {
    try {
      return await prisma.shippingZone.findMany({ where: { active: true }, select, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    } catch (e) {
      console.error("[shipping] no se pudieron cargar las zonas:", e instanceof Error ? e.message : e);
      return [];
    }
  },
  ["public:shipping:zones"],
  { tags: [TAG_SHIPPING], revalidate: 300 },
);

export function invalidateShipping() {
  try {
    revalidateTag(TAG_SHIPPING);
  } catch {
    /* fuera de una petición de Next */
  }
}

const money = z.number({ error: "Valor inválido" }).int("Debe ser un número entero").min(0, "No puede ser negativo").max(5_000_000);
const days = z.number({ error: "Días inválidos" }).int().min(0).max(90);

export const shippingZoneInput = z
  .object({
    name: z.string().trim().min(2, "Ponle un nombre a la zona").max(60),
    departments: z.array(z.string().refine((d) => DEPARTMENTS.includes(d), "Departamento no válido")).min(1, "Elige al menos un departamento").max(DEPARTMENTS.length),
    priceCOP: money,
    baseWeightGrams: z.number().int().min(100, "Mínimo 100 g").max(100_000).default(1000),
    extraPerKgCOP: money.default(0),
    minDays: days,
    maxDays: days,
    active: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.maxDays < v.minDays) ctx.addIssue({ code: "custom", path: ["maxDays"], message: "El máximo de días no puede ser menor que el mínimo" });
    if (new Set(v.departments).size !== v.departments.length) ctx.addIssue({ code: "custom", path: ["departments"], message: "Hay departamentos repetidos" });
  });
export type ShippingZoneInput = z.infer<typeof shippingZoneInput>;

export class ShippingZoneError extends Error {}

/** Un departamento solo puede estar en UNA zona activa (si no, el precio sería ambiguo). */
export async function assertNoOverlap(input: Pick<ShippingZoneInput, "departments" | "active">, excludeId?: string, db = prisma) {
  if (!input.active) return;
  const others = await db.shippingZone.findMany({ where: { active: true, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { name: true, departments: true } });
  for (const o of others) {
    const dup = input.departments.filter((d) => o.departments.includes(d));
    if (dup.length) throw new ShippingZoneError(`${dup.join(", ")} ya ${dup.length === 1 ? "está" : "están"} en la zona "${o.name}".`);
  }
}

export const listShippingZonesAdmin = () => prisma.shippingZone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
