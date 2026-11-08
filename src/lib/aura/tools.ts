import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { BUSINESS, whatsappUrl } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sortSizes } from "@/lib/sizes";
import type { AuraConfig } from "./config";
import { POLICY_TOPICS, storeKnowledge } from "./knowledge";
import { scanPrivate } from "./privacy";
import type { ToolCall, ToolSpec } from "./provider";

/**
 * Herramientas de AURA. Reglas:
 * - Todas son de LECTURA del catálogo público y de las políticas, salvo `preparar_solicitud`, que solo guarda
 *   un BORRADOR en la conversación: la solicitud se crea cuando el cliente pulsa "Confirmar" (otra ruta).
 * - Ninguna recibe ni devuelve datos de clientes, pedidos, precios editables ni estados administrativos.
 * - Los argumentos del modelo se validan con Zod; si no cumplen, el modelo recibe un error, no un dato.
 */

export interface ProductCard { slug: string; name: string; brand: string; priceCOP: number; price: string; image: string | null; sizes: string[]; soldOut: boolean; url: string }
export interface RequestDraft {
  producto: string; marca: string | null; modelo: string | null; talla: string | null; color: string | null; caracteristicas: string | null;
  presupuesto_cop: number | null; tienda_referencia: string | null; resumen: string; pendientes: string[]; prioridad: "alta" | "normal" | "baja";
}
export interface Handoff { reason: string; whatsapp: string | null; contact: string; pqr: string }

/** Lo que las herramientas dejan para la interfaz (tarjetas), además de lo que ve el modelo. */
export interface ToolOutputs { products: ProductCard[]; draft: RequestDraft | null; handoff: Handoff | null }

const str = (max: number) => z.string().trim().max(max);
const opt = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

const searchArgs = z.object({ texto: str(120).min(1), categoria: opt(40), talla: opt(10), precio_max_cop: z.number().int().positive().max(200_000_000).nullish() });
const productArgs = z.object({ slug: z.string().trim().regex(/^[a-z0-9-]{1,120}$/) });
const policyArgs = z.object({ tema: z.enum(POLICY_TOPICS) });
const PENDING = ["marca", "modelo", "talla", "color", "caracteristicas", "presupuesto", "tienda_referencia", "referencia_visual"] as const;
export const draftArgs = z.object({
  producto: str(160).min(2), marca: opt(60), modelo: opt(80), talla: opt(40), color: opt(60), caracteristicas: opt(600),
  presupuesto_cop: z.number().int().min(0).max(200_000_000).nullish().transform((v) => v ?? null), tienda_referencia: opt(120),
  resumen: str(600).min(10), pendientes: z.array(z.enum(PENDING)).max(PENDING.length).default([]), prioridad: z.enum(["alta", "normal", "baja"]).default("normal"),
});
const humanArgs = z.object({ motivo: str(300).min(2) });

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "buscar_productos",
    description: "Busca en el catálogo REAL de 7H STORE (productos activos y públicos). Úsala antes de recomendar o de decir que algo no está. Devuelve nombre, marca, precio en COP, tallas con existencias y enlace.",
    parameters: { type: "object", properties: { texto: { type: "string", description: "Qué buscar: tipo de producto, marca o modelo (p. ej. 'tenis nike', 'audífonos')." }, categoria: { type: "string", description: "Opcional: slug de categoría (calzado, ropa, accesorios, tecnologia)." }, talla: { type: "string", description: "Opcional: talla que debe tener existencias." }, precio_max_cop: { type: "integer", description: "Opcional: precio máximo en pesos." } }, required: ["texto"] },
  },
  {
    name: "ver_producto",
    description: "Ficha completa de un producto del catálogo por su slug (descripción, características, tallas con existencias, precio).",
    parameters: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "consultar_politicas",
    description: "Texto oficial de 7H STORE sobre un tema. Úsala para cualquier pregunta de pagos, envíos, devoluciones, garantía, cuenta, cómo comprar o búsqueda personalizada. No respondas esos temas de memoria.",
    parameters: { type: "object", properties: { tema: { type: "string", enum: [...POLICY_TOPICS] } }, required: ["tema"] },
  },
  {
    name: "preparar_solicitud",
    description: "Prepara el BORRADOR de una búsqueda personalizada (producto que no está en el catálogo). NO crea nada: la aplicación le muestra al cliente una tarjeta para revisar y confirmar. Úsala solo cuando ya sepas qué producto busca y el cliente esté de acuerdo en que lo busquemos. Lo desconocido va en 'pendientes', nunca inventado.",
    parameters: {
      type: "object",
      properties: {
        producto: { type: "string", description: "Qué busca, en palabras simples." }, marca: { type: "string" }, modelo: { type: "string" }, talla: { type: "string" }, color: { type: "string" },
        caracteristicas: { type: "string" }, presupuesto_cop: { type: "integer" }, tienda_referencia: { type: "string", description: "País o tienda donde lo vio, si lo dijo." },
        resumen: { type: "string", description: "2 o 3 frases para el equipo: qué busca, lo esencial y lo que falta. Sin datos personales." },
        pendientes: { type: "array", items: { type: "string", enum: [...PENDING] } }, prioridad: { type: "string", enum: ["alta", "normal", "baja"], description: "alta solo si el cliente expresó urgencia o fecha." },
      },
      required: ["producto", "resumen"],
    },
  },
  {
    name: "solicitar_atencion_humana",
    description: "Ofrece hablar con una persona del equipo (WhatsApp o contacto). Úsala si el cliente lo pide, si hay un reclamo, un pedido con problemas, o si no sabes la respuesta.",
    parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] },
  },
];

const visible = { active: true, customOnly: false, category: { active: true } } as const;
const select = { slug: true, name: true, brand: true, priceCOP: true, compareAtPriceCOP: true, images: true, sizes: true, stock: true, color: true, model: true, category: { select: { slug: true, label: true } }, variants: { select: { size: true, stock: true } } } as const;
type Row = { slug: string; name: string; brand: string; priceCOP: number; compareAtPriceCOP: number | null; images: string[]; sizes: string[]; stock: number; color: string | null; model: string | null; category: { slug: string; label: string }; variants: { size: string; stock: number }[] };

function card(p: Row): ProductCard {
  const inStock = p.variants.length ? sortSizes(p.variants.filter((v) => v.stock > 0).map((v) => v.size)) : p.stock > 0 ? p.sizes : [];
  return { slug: p.slug, name: p.name, brand: p.brand, priceCOP: p.priceCOP, price: formatCOP(p.priceCOP), image: p.images[0] ?? null, sizes: inStock, soldOut: p.stock <= 0, url: `/producto/${p.slug}` };
}

export function createToolRunner(cfg: Pick<AuraConfig, "catalogIsDemo">, db: PrismaClient = prisma) {
  const outputs: ToolOutputs = { products: [], draft: null, handoff: null };
  const note = cfg.catalogIsDemo ? "IMPORTANTE: el catálogo actual es DEMOSTRATIVO. Si muestras productos, dilo claramente: son ejemplos y la disponibilidad real se confirma antes de comprar." : null;

  async function execute(call: ToolCall): Promise<unknown> {
    switch (call.name) {
      case "buscar_productos": {
        const a = searchArgs.safeParse(call.args);
        if (!a.success) return { error: "Parámetros no válidos." };
        const words = a.data.texto.toLowerCase().split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
        const rows = (await db.product.findMany({
          where: {
            ...visible,
            ...(a.data.categoria ? { category: { active: true, slug: a.data.categoria } } : {}),
            ...(a.data.precio_max_cop ? { priceCOP: { lte: a.data.precio_max_cop } } : {}),
            AND: words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { brand: { contains: w, mode: "insensitive" as const } }, { tags: { has: w } }, { category: { label: { contains: w, mode: "insensitive" as const } } }, { description: { contains: w, mode: "insensitive" as const } }] })),
          },
          select, take: 6, orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        })) as Row[];
        let cards = rows.map(card);
        if (a.data.talla) cards = cards.filter((c) => c.sizes.includes(a.data.talla!.toUpperCase()) || c.sizes.includes(a.data.talla!));
        outputs.products.push(...cards.filter((c) => !outputs.products.some((x) => x.slug === c.slug)).slice(0, 6 - outputs.products.length));
        return { nota: note, total: cards.length, productos: cards.map((c) => ({ slug: c.slug, nombre: c.name, marca: c.brand, precio: c.price, tallas_con_existencias: c.sizes, agotado: c.soldOut, enlace: c.url })) };
      }
      case "ver_producto": {
        const a = productArgs.safeParse(call.args);
        if (!a.success) return { error: "Slug no válido." };
        const p = await db.product.findFirst({ where: { ...visible, slug: a.data.slug }, select: { ...select, description: true, features: true, material: true, origin: true, condition: true, warranty: true } });
        if (!p) return { error: "Ese producto no está en el catálogo." };
        const c = card(p as unknown as Row);
        if (!outputs.products.some((x) => x.slug === c.slug)) outputs.products.push(c);
        return {
          nota: note, nombre: p.name, marca: p.brand, modelo: p.model, color: p.color, categoria: p.category.label, precio: c.price,
          precio_antes: p.compareAtPriceCOP ? formatCOP(p.compareAtPriceCOP) : null, tallas_con_existencias: c.sizes, agotado: c.soldOut,
          descripcion: p.description.slice(0, 700), caracteristicas: p.features.slice(0, 8), material: p.material, origen_confirmado: p.origin, estado: p.condition, garantia: p.warranty, enlace: c.url,
        };
      }
      case "consultar_politicas": {
        const a = policyArgs.safeParse(call.args);
        if (!a.success) return { error: `Tema no válido. Temas: ${POLICY_TOPICS.join(", ")}.` };
        const k = storeKnowledge()[a.data.tema];
        return { tema: a.data.tema, fuente: k.fuente, texto: k.texto };
      }
      case "preparar_solicitud": {
        const a = draftArgs.safeParse(call.args);
        if (!a.success) return { error: "Faltan datos del producto o el resumen." };
        // El modelo no tiene datos personales, pero se revisa igual: nada privado entra al borrador.
        const clean = Object.fromEntries(Object.entries(a.data).map(([k, v]) => [k, typeof v === "string" ? scanPrivate(v).text : v])) as unknown as RequestDraft;
        outputs.draft = clean;
        return { ok: true, mensaje: "Se mostró al cliente la tarjeta para revisar y confirmar. La solicitud AÚN NO existe: díselo y espera su confirmación en la tarjeta. No inventes número de seguimiento." };
      }
      case "solicitar_atencion_humana": {
        const a = humanArgs.safeParse(call.args);
        if (!a.success) return { error: "Motivo no válido." };
        const wa = whatsappUrl(BUSINESS.whatsapp);
        outputs.handoff = { reason: scanPrivate(a.data.motivo).text, whatsapp: wa ? `${wa}?text=${encodeURIComponent("Hola 7H STORE, vengo del chat de AURA.")}` : null, contact: "/contacto", pqr: "/cuenta/solicitudes" };
        return { ok: true, canales: [wa ? "WhatsApp" : null, "formulario de contacto", "garantías y PQR en Mi cuenta"].filter(Boolean), mensaje: "La aplicación ya muestra los botones de contacto." };
      }
      default:
        return { error: "Esa herramienta no existe." };
    }
  }
  return { execute, outputs };
}
