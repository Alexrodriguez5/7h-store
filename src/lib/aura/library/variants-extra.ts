/**
 * Formas adicionales de preguntar (16-11-2026), escritas a partir de las respuestas ya aprobadas de la semilla.
 * No agregan información nueva: solo ayudan a reconocer la misma pregunta dicha de otra manera, con errores
 * de escritura, en tono informal o desde el celular. Entran como SINTÉTICAS y "pendiente": el administrador
 * las aprueba desde el panel (Cerebro de AURA → Aprobar formas de preguntar pendientes).
 */
export const EXTRA_VARIANTS: Record<string, string[]> = {
  "que-es-7h": [
    "qué venden ustedes", "a qué se dedican", "que tienda es esta", "de dónde son los productos", "venden cosas de estados unidos?",
    "que es 7hstore", "quienes son ustedes", "esta tienda que vende", "productos importados de usa", "que marcas manejan", "son una tienda colombiana?", "cuentame de la tienda",
  ],
  confianza: [
    "es seguro comprarles", "no es estafa?", "como se que no me van a robar", "son de confianza", "la tienda es real?", "es una pagina seria",
    "es confiable esta pagina", "puedo confiar en ustedes", "como sé que son serios", "es una empresa formal", "existe la tienda de verdad", "me da desconfianza comprar online",
  ],
  "como-comprar": [
    "como hago un pedido", "como compro algo", "pasos para comprar", "como funciona la compra", "quiero comprar como hago", "como pido un producto",
    "cómo se compra aqui", "explicame como pedir", "que tengo que hacer para comprar", "como agrego al carrito y pago", "proceso de compra", "como finalizo mi compra",
  ],
  "comprar-sin-cuenta": [
    "tengo que registrarme para comprar", "puedo comprar sin cuenta", "es obligatorio crear cuenta", "sin registrarme puedo pedir", "necesito usuario para comprar",
    "compro como invitado?", "hay que hacer cuenta?", "puedo pedir sin crear perfil", "me toca registrarme", "comprar sin inscribirme", "se puede sin cuenta", "obligan a crear cuenta",
  ],
  "metodos-pago": [
    "como puedo pagar", "aceptan tarjeta de credito", "puedo pagar con pse", "reciben transferencia", "formas de pago", "medios de pago disponibles",
    "aceptan nequi", "pago contra entrega?", "puedo pagar con debito", "pagan por bancolombia", "con que pago", "se puede pagar en efectivo",
  ],
  impuestos: [
    "el precio tiene iva", "hay que pagar aduana", "cobran impuestos aparte", "el precio es final", "me toca pagar impuestos al recibir", "incluye iva?",
    "el valor ya es con impuestos", "hay cobros extra de aduana", "precio con todo incluido", "pago algo adicional al llegar", "el precio incluye nacionalizacion", "cobran algo mas",
  ],
  "tiempo-pago": [
    "cuanto tiempo tengo para pagar", "hasta cuando puedo pagar mi pedido", "si no pago hoy que pasa", "me guardan el producto", "cuanto dura la reserva",
    "se vence el pedido", "plazo para pagar", "en cuantas horas debo pagar", "el pedido expira?", "pierdo el producto si no pago", "cuanto me apartan las unidades", "tiempo limite de pago",
  ],
  "costo-envio": [
    "cuanto vale el envio", "el envio es gratis", "cuanto cobran por enviar", "precio del domicilio", "desde cuanto es envio gratis", "costo de envio a bogota",
    "cuanto sale mandar el pedido", "valor del flete", "cobran envio", "el envio tiene costo", "cuanto pago de envio", "envio gratis desde que valor",
  ],
  "tiempo-envio": [
    "cuanto se demora en llegar", "en cuantos dias llega", "cuando me llega el pedido", "tiempo de entrega", "cuanto tarda el envio", "en cuanto tiempo lo recibo",
    "demora la entrega", "cuantos dias habiles", "llega rapido?", "cuando despachan", "plazo de entrega", "cuanto se tarda en llegar a mi casa",
  ],
  "cobertura-envio": [
    "envian a mi ciudad", "llegan a todo el pais", "hacen envios a pueblos", "mandan a medellin", "envian a cali", "llegan a zonas rurales",
    "envian fuera de bogota", "despachan a cualquier ciudad", "hay envios nacionales", "envian a la costa", "llegan a villavicencio", "a que ciudades envian",
  ],
  "seguimiento-pedido": [
    "donde esta mi pedido", "como rastreo mi compra", "estado de mi pedido", "ya enviaron mi pedido", "numero de guia", "como sigo el envio",
    "no me ha llegado el pedido", "quiero saber de mi orden", "rastrear mi paquete", "en que va mi compra", "como veo mi pedido", "seguimiento de mi orden",
  ],
  retracto: [
    "puedo devolver lo que compre", "me arrepenti de la compra", "quiero devolver un producto", "derecho de retracto", "como hago una devolucion", "no me gusto puedo devolverlo",
    "cuantos dias tengo para devolver", "me devuelven la plata", "quiero cancelar y que me reembolsen", "politica de devoluciones", "devolucion de dinero", "cambie de opinion",
  ],
  garantia: [
    "tiene garantia", "cuanto dura la garantia", "el producto vino malo", "llego dañado", "salio defectuoso", "como hago valer la garantia",
    "se daño a los pocos dias", "garantia del fabricante", "que cubre la garantia", "reclamar garantia", "no funciona lo que compre", "llego roto",
  ],
  pqr: [
    "quiero poner una queja", "como hago un reclamo", "radicar pqr", "tengo una queja", "donde me quejo", "presentar una peticion",
    "quiero reclamar", "como pongo una denuncia", "estoy inconforme", "no me resolvieron", "quiero hacer un reclamo formal", "a donde envio mi queja",
  ],
  "busqueda-personalizada": [
    "me consiguen un producto", "no encuentro lo que busco", "pueden traer algo que no tienen", "busco un modelo especifico", "lo traen de estados unidos",
    "quiero encargar algo", "hacen pedidos especiales", "pueden buscarme unos tenis", "consiguen productos por encargo", "no esta en el catalogo", "me lo pueden importar", "pedido personalizado",
  ],
  "consultar-solicitud": [
    "como va mi solicitud", "ya respondieron mi busqueda", "estado de mi busqueda personalizada", "donde veo mi solicitud", "me enviaron alternativas",
    "revisar mi encargo", "que paso con mi pedido especial", "consultar mi busqueda", "ver propuestas de mi solicitud", "ya tienen mi producto encargado", "seguimiento de mi solicitud", "respuesta a mi busqueda",
  ],
  "crear-cuenta": [
    "como me registro", "crear cuenta", "como inicio sesion", "olvide mi contraseña", "entrar a mi cuenta", "registrarme con google",
    "no puedo entrar", "como hago mi perfil", "ingresar a la tienda", "recuperar mi cuenta", "iniciar sesion con correo", "abrir una cuenta",
  ],
  "hablar-asesor": [
    "quiero hablar con alguien", "me comunico con un asesor", "tienen whatsapp", "numero de contacto", "hablar con una persona real", "atencion al cliente",
    "pasame con un humano", "como los llamo", "quiero un asesor", "contacto de la tienda", "necesito ayuda de una persona", "correo de soporte",
  ],
};
