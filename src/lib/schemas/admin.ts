import { z } from "zod";
import { isAllowedImageUrl } from "@/lib/images";
import { isValidSize } from "@/lib/sizes";

/** Formato de slug: minúsculas, números y guiones (sin guion al inicio/fin). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** "Todo" es el filtro del catálogo, no una categoría. Estos slugs no se pueden usar. */
export const RESERVED_CATEGORY_SLUGS = ["todo", "todos", "todas", "catalogo", "admin", "api"];
export const GENDERS = ["HOMBRE", "MUJER", "UNISEX"] as const;

export const slugify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

const stockInt = z.number({ error: "Stock inválido" }).int("El stock debe ser entero").min(0, "El stock no puede ser negativo").max(100_000);

export const variantInput = z.object({
  size: z.string().trim().min(1, "Talla requerida").max(10).transform((s) => s.toUpperCase()),
  stock: stockInt,
  /** Stock que el admin VIO al abrir el formulario. Si no lo cambió, no se toca (evita deshacer reservas de compras). */
  expectedStock: stockInt.optional(),
});

export const productInput = z
  .object({
    name: z.string().trim().min(3, "El nombre es obligatorio (mín. 3 caracteres)").max(120),
    slug: z.string().trim().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (minúsculas, números y guiones)").optional().or(z.literal("")),
    brand: z.string().trim().min(1, "La marca es obligatoria").max(60),
    description: z.string().trim().min(10, "Describe el producto (mín. 10 caracteres)").max(4000),
    priceCOP: z.number({ error: "Precio inválido" }).int("El precio debe ser entero").positive("El precio debe ser mayor a 0").max(100_000_000),
    compareAtPriceCOP: z.number().int().positive().max(100_000_000).nullable().optional(),
    /** Slug de una categoría existente; el servicio comprueba que exista y esté activa. */
    category: z
      .string({ error: "Categoría no válida" })
      .trim()
      .min(1, "Elige una categoría")
      .max(40)
      .regex(SLUG_RE, "Categoría no válida")
      .refine((s) => !RESERVED_CATEGORY_SLUGS.includes(s), "Categoría no válida"),
    gender: z.enum(GENDERS, { error: "Género no válido" }).default("UNISEX"),
    isAccessory: z.boolean().default(false),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    images: z.array(z.string().max(600).refine(isAllowedImageUrl, "Imagen no válida: usa una subida o una URL https permitida")).min(1, "Agrega al menos una imagen").max(8),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    /** Stock total para productos SIN tallas. Se ignora si hay variantes. */
    stock: stockInt.default(0),
    /** Stock que el admin vio al abrir el formulario (producto sin tallas). */
    expectedStock: stockInt.optional(),
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
  z.object({ stock: stockInt, expectedStock: stockInt.optional() }),
  z.object({ variants: z.array(z.object({ id: z.string().min(1), stock: stockInt, expectedStock: stockInt.optional() })).min(1).max(30) }),
]);
export type StockInput = z.infer<typeof stockInput>;

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

const categoryLabel = z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(40, "Máximo 40 caracteres");
const categoryImage = z.string().trim().max(600).refine(isAllowedImageUrl, "Imagen no válida: usa una subida o una URL https permitida").nullable().optional().or(z.literal("").transform(() => null));

export const categoryCreateInput = z.object({
  label: categoryLabel,
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(40, "Máximo 40 caracteres")
    .regex(SLUG_RE, "Slug inválido: usa minúsculas, números y guiones (ej. relojes-inteligentes)")
    .refine((s) => !RESERVED_CATEGORY_SLUGS.includes(s), "Ese slug está reservado"),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  imageUrl: categoryImage,
});
export type CategoryCreateInput = z.infer<typeof categoryCreateInput>;

/** El slug NO se edita: forma parte de los enlaces públicos (/catalogo?categoria=…). */
export const categoryUpdateInput = z
  .object({ label: categoryLabel.optional(), sortOrder: z.number().int().min(0).max(9999).optional(), imageUrl: categoryImage, active: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "No hay cambios");
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInput>;

// ---------- Cuentas administrativas ----------
const adminEmail = z.string().trim().toLowerCase().email("Correo no válido").max(200);
const newPassword = z.string().min(12, "La contraseña debe tener al menos 12 caracteres").max(200);

export const adminUserInput = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  email: adminEmail,
  role: z.enum(["OWNER", "ADMIN"]).default("ADMIN"),
  password: newPassword,
});

export const adminUserAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("revoke_sessions") }),
  z.object({ action: z.literal("role"), role: z.enum(["OWNER", "ADMIN"]) }),
  z.object({ action: z.literal("reset_password"), password: newPassword }),
]);

export const changePasswordInput = z.object({ currentPassword: z.string().min(1, "Escribe tu contraseña actual").max(200), newPassword });

export const orderListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "EXPIRED"]).optional(),
  method: z.enum(["CARD", "PSE", "BANK_TRANSFER", "CASH_DEPOSIT"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
