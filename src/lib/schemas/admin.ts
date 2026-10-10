import { z } from "zod";
import { isAllowedImageUrl } from "@/lib/images";
import { isValidSize } from "@/lib/sizes";

export const CATEGORY_SLUGS = ["tecnologia", "ropa", "calzado", "accesorios"] as const;
export const GENDERS = ["HOMBRE", "MUJER", "UNISEX"] as const;

export const slugify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

const stockInt = z.number({ error: "Stock inválido" }).int("El stock debe ser entero").min(0, "El stock no puede ser negativo").max(100_000);

export const variantInput = z.object({
  size: z.string().trim().min(1, "Talla requerida").max(10).transform((s) => s.toUpperCase()),
  stock: stockInt,
});

export const productInput = z
  .object({
    name: z.string().trim().min(3, "El nombre es obligatorio (mín. 3 caracteres)").max(120),
    slug: z.string().trim().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (minúsculas, números y guiones)").optional().or(z.literal("")),
    brand: z.string().trim().min(1, "La marca es obligatoria").max(60),
    description: z.string().trim().min(10, "Describe el producto (mín. 10 caracteres)").max(4000),
    priceCOP: z.number({ error: "Precio inválido" }).int("El precio debe ser entero").positive("El precio debe ser mayor a 0").max(100_000_000),
    compareAtPriceCOP: z.number().int().positive().max(100_000_000).nullable().optional(),
    category: z.enum(CATEGORY_SLUGS, { error: "Categoría no válida" }),
    gender: z.enum(GENDERS, { error: "Género no válido" }).default("UNISEX"),
    isAccessory: z.boolean().default(false),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    images: z.array(z.string().max(600).refine(isAllowedImageUrl, "Imagen no válida: usa una subida o una URL https permitida")).min(1, "Agrega al menos una imagen").max(8),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    /** Stock total para productos SIN tallas. Se ignora si hay variantes. */
    stock: stockInt.default(0),
    variants: z.array(variantInput).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPriceCOP != null && v.compareAtPriceCOP <= v.priceCOP) {
      ctx.addIssue({ code: "custom", path: ["compareAtPriceCOP"], message: "El precio anterior debe ser mayor al precio actual" });
    }
    const seen = new Set<string>();
    v.variants.forEach((variant, i) => {
      if (seen.has(variant.size)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: `Talla repetida: ${variant.size}` });
      seen.add(variant.size);
      if (!isValidSize(v.category, variant.size)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: `Talla no válida para ${v.category}: ${variant.size}` });
    });
  });
export type ProductInput = z.infer<typeof productInput>;
export type ProductFormInput = z.input<typeof productInput>;

export const toggleActiveInput = z.object({ active: z.boolean() });

/** Edición rápida de inventario: producto sin tallas ({stock}) o tallas ({variants:[{id,stock}]}). */
export const stockInput = z.union([
  z.object({ stock: stockInt }),
  z.object({ variants: z.array(z.object({ id: z.string().min(1), stock: stockInt })).min(1).max(30) }),
]);

export const orderActionInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
    carrier: z.string().trim().max(60).optional(),
    trackingNumber: z.string().trim().max(60).optional(),
    restock: z.boolean().optional(),
  }),
  z.object({ action: z.literal("confirm_manual_payment") }),
]);

export const categoryInput = z.object({ label: z.string().trim().min(2, "Nombre muy corto").max(40) });

export const orderListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "EXPIRED"]).optional(),
  method: z.enum(["CARD", "PSE", "BANK_TRANSFER", "CASH_DEPOSIT"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
