import { CardIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";

/**
 * Presentación institucional de 7H STORE (portada y /nosotros).
 * Solo afirma lo que la tienda hace de verdad: precios en COP con impuestos, pagos con Wompi,
 * envío con guía, seguimiento en la cuenta, garantía legal y PQR con radicado.
 */
export const BRAND_STORY = [
  "7H STORE nace con una idea clara: que encontrar productos de calidad sea más fácil, más accesible y más confiable.",
  "Seleccionamos productos de diferentes categorías para reunir en un solo lugar tendencias, tecnología, estilo y soluciones para tu día a día. Tú eliges; nosotros nos encargamos de que llegue bien.",
  "Creemos que comprar no debería ser complicado. Por eso cada paso está pensado para darte tranquilidad: información clara, precios finales en pesos colombianos, pagos seguros y seguimiento de cada pedido.",
];

export const BRAND_PILLARS = [
  { Icon: ShieldIcon, title: "Calidad", text: "Productos seleccionados, con información clara antes de comprar y garantía legal después." },
  { Icon: CardIcon, title: "Estilo", text: "Tendencias, tecnología y piezas para tu día a día, reunidas en una sola tienda." },
  { Icon: TruckIcon, title: "Confianza", text: "Precios en COP con impuestos, pagos seguros con Wompi, guía de envío y seguimiento en tu cuenta." },
] as const;

export const BRAND_PROMISES = [
  "Precios finales en pesos colombianos, con impuestos incluidos.",
  "Tarjeta y PSE con Wompi, transferencia o consignación. No guardamos los datos de tu tarjeta.",
  "Envío a toda Colombia con transportadora y número de guía.",
  "Todos tus pedidos, su pago y su envío, en Mi cuenta.",
  "Derecho de retracto, garantía legal y PQR con número de radicado.",
];
