/**
 * Conocimiento inicial de AURA, tomado SOLO de lo que ya publica la tienda (preguntas frecuentes, envíos,
 * devoluciones, cómo comprar, búsqueda personalizada, cuenta). Cada entrada dice su fuente.
 *
 * - `questions`: preguntas tal como aparecen en la web (no sintéticas).
 * - `variants`: otras formas de preguntar lo mismo, escritas a partir de esa respuesta: quedan marcadas como
 *   SINTÉTICAS y entran como "pendiente" hasta que el administrador las aprueba.
 * - `body` usa marcadores {{...}} que se llenan al responder con los valores vigentes de la tienda
 *   (umbral de envío gratis, plazo, aviso de pagos): así la respuesta no se queda desactualizada.
 */
export interface SeedEntry { slug: string; category: string; title: string; body: string; source: string; sourceUrl: string; questions: string[]; variants: string[] }

export const SEED_VERSION = "2026-11-08";

export const SEED: SeedEntry[] = [
  {
    slug: "que-es-7h", category: "tienda", title: "¿Qué es 7H STORE?", source: "Página Nosotros", sourceUrl: "/nosotros",
    body: "7H STORE es una tienda en línea colombiana: Calidad. Estilo. Confianza. Reunimos productos de diferentes categorías (tendencias, tecnología, estilo y soluciones para el día a día) con precios finales en pesos colombianos, pagos seguros y seguimiento de cada pedido. Si quieres, te ayudo a encontrar algo puntual.",
    questions: ["¿Qué es 7H STORE?"],
    variants: ["¿Quiénes son ustedes?", "¿Qué venden?", "Cuéntame de la tienda", "¿De qué se trata 7H?", "¿Qué tipo de tienda es?", "que es 7h store"],
  },
  {
    slug: "confianza", category: "tienda", title: "¿Es confiable comprar en 7H STORE?", source: "Página Nosotros y Términos", sourceUrl: "/nosotros",
    body: "Puedes comprar con tranquilidad: los precios son finales en COP con impuestos incluidos, el pago con tarjeta o PSE se hace a través de Wompi (7H STORE no guarda los datos de tu tarjeta), cada envío lleva transportadora y número de guía, y tienes derecho de retracto, garantía legal y PQR con número de radicado.",
    questions: ["¿Es seguro comprar en 7H STORE?"],
    variants: ["¿Es confiable la tienda?", "¿Es una tienda seria?", "¿No es estafa?", "¿Puedo confiar en ustedes?", "es segura la pagina"],
  },
  {
    slug: "como-comprar", category: "compras", title: "¿Cómo compro?", source: "Página Cómo comprar", sourceUrl: "/como-comprar",
    body: "Es sencillo: 1) elige el producto en el catálogo (y la talla, si la tiene); 2) agrégalo al carrito; 3) completa tus datos de entrega y elige el medio de pago; las unidades quedan reservadas 24 horas mientras pagas; 4) sigue tu pedido en Mi cuenta con el correo de la compra.{{aviso_pagos}}",
    questions: ["¿Cómo compro?", "¿Cómo puedo comprar?"],
    variants: ["¿Cuáles son los pasos para comprar?", "¿Cómo hago un pedido?", "¿Cómo pido algo?", "quiero comprar como hago", "como se compra en la pagina", "¿Cómo funciona la compra?"],
  },
  {
    slug: "comprar-sin-cuenta", category: "compras", title: "¿Necesito una cuenta para comprar?", source: "Preguntas frecuentes", sourceUrl: "/preguntas-frecuentes",
    body: "No. Puedes comprar como invitado. Si después entras a Mi cuenta con el mismo correo de la compra, verás todos tus pedidos.",
    questions: ["¿Necesito crear una cuenta para comprar?"],
    variants: ["¿Puedo comprar sin registrarme?", "¿Tengo que crear usuario?", "¿Es obligatorio tener cuenta?", "comprar como invitado"],
  },
  {
    slug: "metodos-pago", category: "pagos", title: "¿Qué medios de pago aceptan?", source: "Preguntas frecuentes", sourceUrl: "/preguntas-frecuentes",
    body: "Aceptamos tarjeta y PSE a través de Wompi, transferencia y consignación. 7H STORE no almacena los datos de tu tarjeta.{{aviso_pagos}}",
    questions: ["¿Qué medios de pago aceptan?", "¿Qué métodos de pago aceptan?"],
    variants: ["¿Cómo puedo pagar?", "¿Aceptan tarjeta de crédito?", "¿Puedo pagar con PSE?", "¿Reciben transferencia?", "formas de pago", "¿Se puede pagar con débito?", "medios de pago"],
  },
  {
    slug: "impuestos", category: "pagos", title: "¿Los precios incluyen impuestos?", source: "Preguntas frecuentes", sourceUrl: "/preguntas-frecuentes",
    body: "Sí. Todos los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables.",
    questions: ["¿Los precios incluyen impuestos?"],
    variants: ["¿El precio tiene IVA?", "¿Tengo que pagar impuestos aparte?", "¿Los precios son en pesos?", "el precio incluye iva"],
  },
  {
    slug: "tiempo-pago", category: "pagos", title: "¿Cuánto tiempo tengo para pagar?", source: "Preguntas frecuentes", sourceUrl: "/preguntas-frecuentes",
    body: "Al crear el pedido reservamos las unidades durante 24 horas. Si el pago no se completa en ese plazo, el pedido expira y las unidades se liberan.",
    questions: ["¿Cuánto tiempo tengo para pagar?"],
    variants: ["¿Me apartan el producto?", "¿Cuánto dura la reserva?", "¿Qué pasa si no pago de una vez?", "se vence el pedido si no pago"],
  },
  {
    slug: "costo-envio", category: "envios", title: "¿Cuánto cuesta el envío?", source: "Página Envíos", sourceUrl: "/envios",
    body: "El envío es gratis en compras desde {{envio_gratis}}. En compras menores, el costo exacto según tu ciudad y el peso del pedido aparece en el checkout antes de pagar.",
    questions: ["¿Cuánto cuesta el envío?"],
    variants: ["¿Cuánto vale el envío?", "¿Cuánto cobran por transporte?", "¿El domicilio tiene costo?", "¿El envío está incluido?", "¿Cuánto me cuesta recibirlo?", "¿Cuánto cuesta traer un producto?", "¿El envío es gratis?", "cuanto vale el domicilio", "¿Cuánto cobran por llevarlo a mi ciudad?"],
  },
  {
    slug: "tiempo-envio", category: "envios", title: "¿Cuánto tarda en llegar?", source: "Página Envíos", sourceUrl: "/envios",
    body: "Plazo estimado: {{plazo_envio}}, contado desde la confirmación del pago. Depende de la transportadora y puede variar en temporadas altas o zonas de difícil acceso.",
    questions: ["¿Cuánto tarda en llegar?"],
    variants: ["¿En cuántos días llega?", "¿Cuánto se demora el envío?", "¿Cuándo me llega el pedido?", "tiempo de entrega", "¿Qué tan rápido despachan?", "cuantos dias se demora"],
  },
  {
    slug: "cobertura-envio", category: "envios", title: "¿Hacen envíos a toda Colombia?", source: "Página Envíos", sourceUrl: "/envios",
    body: "Sí. Enviamos a todos los departamentos de Colombia, con transportadora y número de guía. La dirección de entrega se indica en el checkout.",
    questions: ["¿Hacen envíos a toda Colombia?"],
    variants: ["¿Envían a mi ciudad?", "¿Llegan a pueblos?", "¿Hacen envíos nacionales?", "¿Mandan a otras ciudades?", "envian a todo el pais"],
  },
  {
    slug: "seguimiento-pedido", category: "seguimiento", title: "¿Cómo sigo mi pedido?", source: "Página Envíos", sourceUrl: "/envios",
    body: "Entra a Mi cuenta → Mis pedidos con el mismo correo de la compra (por Google, código al correo o contraseña). Verás el estado del pago, la transportadora y el número de guía de todos tus pedidos, aunque hayas comprado sin cuenta. Por privacidad, aquí en el chat no consulto pedidos.",
    questions: ["¿Cómo sigo mi pedido?"],
    variants: ["¿Dónde está mi pedido?", "¿Cómo rastreo mi compra?", "¿Dónde veo la guía?", "¿Cómo sé el estado de mi orden?", "quiero saber donde va mi pedido", "numero de guia"],
  },
  {
    slug: "retracto", category: "devoluciones", title: "¿Puedo devolver un producto?", source: "Página Devoluciones", sourceUrl: "/devoluciones",
    body: "Sí. Tienes 5 días hábiles desde la entrega para retractarte (art. 47, Ley 1480 de 2011), salvo las excepciones legales. El producto se devuelve en las mismas condiciones en que lo recibiste, sin uso y con su empaque; el transporte de la devolución corre por tu cuenta. Te devolvemos el dinero en máximo 15 días calendario.",
    questions: ["¿Puedo retractarme de la compra?", "¿Cuántos días tengo para devolver un producto?"],
    variants: ["¿Puedo devolver lo que compré?", "¿Cómo hago una devolución?", "Me arrepentí de la compra", "¿Me devuelven la plata?", "¿Hay reembolso?", "politica de devoluciones", "¿Cuánto tiempo tengo para devolverlo?"],
  },
  {
    slug: "garantia", category: "garantias", title: "¿Los productos tienen garantía?", source: "Página Devoluciones", sourceUrl: "/devoluciones",
    body: "Sí, todos tienen la garantía legal de calidad, idoneidad y seguridad (Ley 1480 de 2011). Si el fabricante no indica un plazo, es de un año desde la entrega. Si un producto presenta un defecto, ábrelo en Mi cuenta → Garantías y PQR con el número de pedido, fotos y una descripción.",
    questions: ["¿Los productos tienen garantía?"],
    variants: ["¿Cuánto dura la garantía?", "Mi producto llegó dañado", "¿Qué hago si sale defectuoso?", "¿Cómo reclamo la garantía?", "el producto salio malo", "garantia de los productos"],
  },
  {
    slug: "pqr", category: "atencion", title: "¿Cómo presento una petición, queja o reclamo?", source: "Preguntas frecuentes", sourceUrl: "/preguntas-frecuentes",
    body: "Desde Mi cuenta → Garantías y PQR recibes un número de radicado. Respondemos en máximo 15 días hábiles. También puedes escribirnos desde la página de Contacto.",
    questions: ["¿Cómo presento una petición, queja o reclamo?"],
    variants: ["Quiero poner una queja", "¿Dónde pongo un reclamo?", "¿Cómo radico una PQR?", "tengo un problema con mi pedido", "¿Cómo me quejo?"],
  },
  {
    slug: "busqueda-personalizada", category: "solicitudes", title: "¿Pueden conseguir un producto que no está en la tienda?", source: "Página Búsqueda personalizada", sourceUrl: "/tu-lo-buscas",
    body: "Sí, podemos buscarlo. Cuéntame qué producto necesitas (marca, modelo, talla o color si los sabes) y, si tienes, una foto o un enlace. Con eso registramos una búsqueda personalizada con número de seguimiento BUS-XXXXXX; el equipo revisa proveedores, precio en pesos y tiempos y te envía alternativas. Antes de esa propuesta no hay precio, disponibilidad ni fecha confirmados.",
    questions: ["¿Pueden conseguir un producto que no está en la tienda?", "¿Cómo solicito un producto?"],
    variants: ["No encuentro lo que busco", "¿Me consiguen un producto?", "¿Traen productos por encargo?", "¿Hacen pedidos especiales?", "Quiero pedir algo que no está en el catálogo", "¿Pueden importar algo para mí?", "busco algo que no aparece"],
  },
  {
    slug: "consultar-solicitud", category: "solicitudes", title: "¿Cómo consulto mi solicitud?", source: "Página Búsqueda personalizada", sourceUrl: "/cuenta/busquedas",
    body: "Puedes verla en Mi cuenta → Mis solicitudes, o con el enlace seguro que te llegó al correo. Ahí ves el estado, las alternativas del equipo y la conversación.",
    questions: ["¿Cómo consulto mi solicitud?", "¿Cómo puedo consultar una solicitud?"],
    variants: ["¿Dónde veo mi búsqueda?", "¿Cómo va mi solicitud?", "¿Ya tienen respuesta de lo que pedí?", "estado de mi solicitud", "¿Dónde veo las alternativas?"],
  },
  {
    slug: "crear-cuenta", category: "compras", title: "¿Cómo entro o creo mi cuenta?", source: "Página Mi cuenta", sourceUrl: "/cuenta",
    body: "En Mi cuenta puedes entrar con Google, con un código que te llega al correo o con contraseña. Con el mismo correo de tus compras verás tus pedidos, tus búsquedas personalizadas y tus garantías.",
    questions: ["¿Cómo creo una cuenta?"],
    variants: ["¿Cómo me registro?", "¿Cómo inicio sesión?", "No puedo entrar a mi cuenta", "¿Cómo entro a mi perfil?", "olvide mi contrasena"],
  },
  {
    slug: "hablar-asesor", category: "atencion", title: "¿Puedo hablar con una persona?", source: "Página Contacto", sourceUrl: "/contacto",
    body: "Claro. Puedes escribirle al equipo por WhatsApp (botón arriba en este chat) o desde la página de Contacto. Si es sobre un pedido o una garantía, lo más rápido es Mi cuenta → Garantías y PQR.",
    questions: ["¿Puedo hablar con un asesor?"],
    variants: ["Quiero hablar con una persona", "¿Tienen WhatsApp?", "¿Cómo los contacto?", "pasame con un humano", "¿Tienen número de teléfono?"],
  },
];
