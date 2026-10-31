# 7H STORE: qué falta antes de abrir la tienda al público

Revisión del 31 de octubre de 2026. Ordenado por riesgo: legal, quejas de clientes y pérdida de dinero.
**Leyenda:** 🔴 bloquea la apertura · 🟠 muy recomendable · 🟢 mejora

---

## A. Legal (Colombia)

| | Qué falta | Por qué | Quién |
|---|---|---|---|
| 🔴 | **Identificación del vendedor en la tienda**: razón social o nombre, NIT o cédula, dirección física, teléfono y correo. | La Ley 1480 de 2011 (art. 50) obliga a quien vende por internet a publicarlos. Sin ellos, la SIC puede sancionar. | Tú me das los datos; yo los cargo (variables `NEXT_PUBLIC_BUSINESS_*`). |
| 🔴 | **Canal de PQR** con correo real y plazo de respuesta (15 días hábiles). | Ley 1480 y Ley 1581: el cliente debe poder reclamar. | Correo tuyo. |
| 🔴 | **Revisión por un abogado** de Términos, Privacidad y Devoluciones. | Los textos se basan en la ley, pero no reemplazan asesoría legal. | Abogado. |
| 🟠 | **Factura electrónica (DIAN).** | Si eres responsable de IVA o superas los topes, cada venta debe facturarse electrónicamente (Alegra, Siigo o el facturador gratuito de la DIAN). La tienda no la genera. | Tu contador. |
| 🟠 | **Registro de la base de datos ante la SIC (RNBD)** si aplica por el tamaño de la empresa. | Ley 1581 y Decreto 090 de 2018. | Contador o abogado. |
| 🟠 | **Garantía de productos importados.** Definir quién la responde y por cuánto tiempo, y publicarlo. | Ley 1480, art. 7 y Decreto 735 de 2013. Hoy la página remite a la garantía legal. | Tú defines. |
| 🟢 | Enlace a la SIC en el pie de página. | Buena práctica de confianza. | Yo. |

## B. Envíos (lo que pediste)

| | Qué falta | Estado |
|---|---|---|
| 🔴 | **Plazos de entrega reales** por ciudad o región. | Hoy aparece "[Pendiente]". |
| 🟠 | **Tarifa según destino y peso.** Hoy es una tarifa única de $18.000 (gratis desde $500.000): pierdes dinero en envíos lejanos o pesados. | Por construir (ver la decisión sobre Servientrega). |
| 🟠 | **Peso y medidas por producto.** Las transportadoras cotizan con eso. | Por agregar al panel (cambio de base de datos sin pérdida de datos). |
| 🟠 | **Guía automática** al marcar un pedido como pagado o preparado. | Depende de la decisión sobre la transportadora. Hoy la guía se escribe a mano en /admin. |
| 🟢 | Enlace de rastreo de la transportadora en "Mis pedidos". | Fácil, después de la integración. |

## C. Evitar quejas de clientes

| | Qué falta | Por qué |
|---|---|---|
| 🔴 | **Correos automáticos al cliente:** pedido recibido, pago confirmado, enviado (con transportadora y guía), entregado, cancelado y vencido. ✅ **Ya programados.** Solo falta activarlos con una cuenta de Resend. | Es la queja n.º 1 en e-commerce. Resend es gratis hasta 3.000 correos al mes: crea la cuenta, verifica tu dominio y agrega `RESEND_API_KEY` y `EMAIL_FROM` en Vercel. |
| 🟠 | **Cron de expiración cada 15–30 minutos.** En Vercel Hobby corre 1 vez al día, así que un pedido sin pagar retiene stock hasta 24 h de más. | Hay 6 pedidos pendientes antiguos reteniendo stock ahora mismo. Se soluciona con cron-job.org (gratis). |
| 🟠 | **Botón de WhatsApp** visible en la tienda. | Atención rápida y menos abandonos. Necesito tu número. |
| 🟢 | Reseñas de clientes, **solo reales** (nunca inventadas). | Más adelante. |

## D. Pagos (Wompi)

| | Qué falta |
|---|---|
| 🔴 | **Probar el pago completo en Sandbox:** aprobado, rechazado y PSE, con el webhook actualizando el pedido. Falta poner la URL de eventos **en modo de pruebas**: `https://7h-store.vercel.app/api/webhooks/wompi`. Tu captura muestra la sección de **producción** (`pub_prod`), cuya URL apunta a un túnel viejo de VS Code. |
| 🔴 | Para cobrar de verdad: cuenta Wompi verificada, llaves `pub_prod`, `prv_prod` y los secretos de producción en Vercel, más la URL de eventos de producción. Solo con tu autorización. |
| 🟠 | Datos bancarios reales (`BANK_*`) para transferencias. |

## E. Infraestructura

| | Qué falta | Por qué |
|---|---|---|
| 🔴 | **Supabase en plan de pago (Pro, unos 25 USD al mes)** o mantenerlo activo. | El plan gratuito **se pausó esta semana**: la tienda se cayó por completo. Una tienda que vende no puede pausarse. |
| 🟠 | Dominio propio (por ejemplo, 7hstore.co) con HTTPS. | Confianza. Vercel lo configura en minutos. |
| 🟠 | Respaldos de la base de datos (incluidos en Supabase Pro). | |
| 🟠 | Cambiar `CRON_SECRET` por uno de 32+ caracteres y considerar hacer privado el repositorio de GitHub. | Seguridad. |
| 🟢 | Google Search Console y analítica. Si agregas píxeles publicitarios, actualiza la política de cookies. | Marketing. |

## F. Datos de prueba que hay que limpiar

- Pedido de prueba **7H-2026-AD612683**: cancelarlo en /admin → Pedidos. La mochila vuelve al stock.
- Revisar los 6 pedidos "pendientes de pago" antiguos y los productos de ejemplo del seed (por ejemplo "Mochila Classic"). Si no son productos reales, desactívalos.

---

### Orden sugerido
1. Supabase Pro.
2. Datos del negocio y correo de PQR.
3. Correos automáticos (Resend).
4. Envíos con tarifas por zona, peso y guía automática.
5. Wompi Sandbox completo.
6. Revisión del abogado.
7. Dominio.
8. Publicar.
