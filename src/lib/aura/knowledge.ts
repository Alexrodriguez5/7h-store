import { BRAND_PROMISES, BRAND_STORY } from "@/components/brand/BrandStory";
import { faqs } from "@/content/faq";
import { BUSINESS } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { DEFAULT_ETA, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

/**
 * Conocimiento de la tienda para AURA, armado desde las MISMAS fuentes que muestra la web:
 * la historia y las promesas de marca (Nosotros), las preguntas frecuentes (/preguntas-frecuentes),
 * los datos comerciales (variables NEXT_PUBLIC_BUSINESS_*) y las constantes de envío.
 * No hay una copia aparte: si cambia una política en esas fuentes, AURA la dice igual que la página.
 */

export const POLICY_TOPICS = ["tienda", "compra", "pagos", "envios", "devoluciones", "garantia", "cuenta", "busqueda_personalizada"] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

const sandboxPayments = () => (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test");

export function storeKnowledge(): Record<PolicyTopic, { fuente: string; texto: string[] }> {
  const groups = faqs();
  const plain = (group: string) => groups.find((g) => g.group === group)?.items.map((i) => `${i.q} ${i.plain}`) ?? [];
  const pagos = plain("Productos y pagos");
  const envios = plain("Envíos y seguimiento");
  const devol = plain("Devoluciones y garantía");
  return {
    tienda: { fuente: "/nosotros", texto: [`${BUSINESS.name}: ${BUSINESS.slogan}`, ...BRAND_STORY, ...BRAND_PROMISES] },
    compra: {
      fuente: "/como-comprar",
      texto: [
        "Pasos: elegir el producto (y la talla si la tiene), agregarlo al carrito, completar los datos de entrega y elegir el medio de pago. Las unidades quedan reservadas 24 horas mientras se completa el pago.",
        "Se puede comprar como invitado; con el mismo correo después se ven los pedidos en Mi cuenta.",
      ],
    },
    pagos: {
      fuente: "/preguntas-frecuentes",
      texto: [
        ...pagos,
        ...(sandboxPayments()
          ? ["AVISO VIGENTE: la pasarela de tarjeta y PSE está en modo de prueba y NO realiza cobros reales. Para comprar hoy hay que elegir transferencia o consignación, o escribir por WhatsApp."]
          : []),
      ],
    },
    envios: { fuente: "/envios", texto: [...envios, `Envío gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}.`, `Plazo estimado: ${BUSINESS.shippingTime ?? DEFAULT_ETA} desde la confirmación del pago.`] },
    devoluciones: { fuente: "/devoluciones", texto: devol.filter((t) => /retract|devol/i.test(t)) },
    garantia: { fuente: "/devoluciones", texto: devol.filter((t) => /garant|queja|reclamo|PQR|petici/i.test(t)) },
    cuenta: {
      fuente: "/cuenta",
      texto: [
        "En Mi cuenta el cliente ve sus pedidos (pago, transportadora y guía), sus búsquedas personalizadas en «Mis solicitudes» y sus garantías y PQR.",
        "AURA no consulta pedidos: el estado de un pedido se ve en Mi cuenta → Pedidos, entrando con el correo de la compra.",
      ],
    },
    busqueda_personalizada: {
      fuente: "/tu-lo-buscas",
      texto: [
        "Si un producto no está en el catálogo, el cliente puede pedir que lo busquemos: describe el producto, puede adjuntar fotos o enlaces y recibe un número de seguimiento BUS-XXXXXX.",
        "El equipo revisa proveedores, disponibilidad, precio final en pesos y tiempos; luego envía una o varias alternativas. El cliente elige, pregunta o rechaza.",
        "Si acepta, el equipo confirma y prepara una oferta privada que se paga en el checkout normal. No todos los productos se pueden conseguir.",
        "Antes de la propuesta del equipo NO hay precio, disponibilidad ni fecha confirmados.",
        "El cliente sigue sus búsquedas en Mi cuenta → Mis solicitudes, o con el enlace seguro que llega por correo.",
      ],
    },
  };
}

/** Resumen corto que va en el prompt de sistema (lo demás se pide con `consultar_politicas`). */
export function knowledgeDigest() {
  return [
    `${BUSINESS.name} (${BUSINESS.slogan}) es una tienda en línea colombiana. Precios en COP con impuestos incluidos.`,
    `Envío a toda Colombia; gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}.`,
    sandboxPayments()
      ? "Pagos: tarjeta y PSE con Wompi están EN MODO DE PRUEBA (no cobran). Hoy se puede pagar por transferencia o consignación."
      : "Pagos: tarjeta y PSE con Wompi, transferencia o consignación.",
  ].join(" ");
}
