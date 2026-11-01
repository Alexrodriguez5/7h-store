# 7H STORE: auditoría de lanzamiento

Fecha: 1 de noviembre de 2026. Rama: `mejora-diseno-rendimiento`. **No se ha publicado nada.** La página pública (7h-store.vercel.app) sigue con la versión anterior.

## 1. Datos de la versión de prueba

| Dato | Valor |
|---|---|
| URL fija de la versión de prueba (Preview) | https://7h-store-git-mejora-diseno-rendimiento-davidalexanderr44-6281.vercel.app (pide iniciar sesión en Vercel; está protegida) |
| Rama | `mejora-diseno-rendimiento` en GitHub (Alexrodriguez5/7h-store) |
| Último commit | ver `git log -1`; el estado de Vercel queda "Deployment has completed" en cada commit |
| Base de datos de pruebas | **Pendiente.** Hoy Preview usa la base de datos REAL (ver sección 2). |

## 2. Aislamiento de la versión de prueba (CRÍTICO)

Revisé las variables de Vercel. Preview comparte con producción las siguientes variables:

- `DATABASE_URL`, es decir, la base de datos con pedidos y clientes reales.
- `WOMPI_*`, las cuatro llaves de pagos.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, donde se guardan las fotos de productos.
- `ADMIN_SESSION_SECRET` y `CRON_SECRET`.

El sistema no me permite editar variables secretas, así que el cambio lo debe hacer el dueño:

1. Crear en Supabase un segundo proyecto, `7h-store-pruebas`.
2. En Vercel, dejar `DATABASE_URL`, `WOMPI_*` y `SUPABASE_*` solo en Production.
3. Crear las mismas variables solo para Preview, con los valores de pruebas y las llaves Sandbox de Wompi.
4. Avisar. Después creo las tablas y cargo productos de ejemplo **solo** en la base de pruebas.

Protección ya agregada en el código: fuera de producción, el pago se bloquea si la llave de Wompi es real (`pub_prod`). Una versión de prueba no puede cobrar dinero real.

## 3. Google Login

**Causa raíz:** no existen credenciales de Google. `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` no están en Vercel ni en `.env.local`. Por eso el botón muestra "estará disponible muy pronto". El código está completo: PKCE, `state` contra CSRF, correo verificado por Google, un solo perfil por correo y sesión con cookie segura.

**Error corregido:** la dirección de regreso de Google se armaba con el dominio de producción. En Preview, Google habría devuelto al cliente al sitio público, y ahí faltaba la cookie de seguridad, así que el inicio de sesión fallaba. Ahora la dirección usa el dominio por el que entró el cliente.

También agregué:
- Un mensaje claro cuando el cliente cancela en Google (`access_denied`).
- El detalle de `invalid_client` o `invalid_grant` en el registro del servidor.

**Configuración en Google Cloud** (console.cloud.google.com, la debe hacer el dueño):

1. Crear un proyecto, por ejemplo "7H STORE".
2. En **APIs y servicios → Pantalla de consentimiento OAuth**, elegir el tipo **Externo** y llenar:
   - Nombre: 7H STORE.
   - Correo de asistencia.
   - Logo (opcional).
   - Dominios autorizados: el dominio propio cuando exista (`vercel.app` no se puede registrar).
   - Enlaces a `/privacidad` y `/terminos`.
3. Alcances: solo `openid`, `email` y `profile`. No requieren verificación de Google.
4. Usuarios de prueba: mientras la app esté "En pruebas", agregar los correos que vayan a probar. Para el lanzamiento, tocar **Publicar app**.
5. En **Credenciales → Crear credenciales → ID de cliente de OAuth**, elegir el tipo **Aplicación web** y llenar:
   - **Orígenes de JavaScript autorizados:**
     - `https://7h-store.vercel.app`
     - `https://7h-store-git-mejora-diseno-rendimiento-davidalexanderr44-6281.vercel.app`
     - `http://localhost:3000`
   - **URI de redireccionamiento autorizados** (exactos, sin barra final):
     - `https://7h-store.vercel.app/api/cuenta/google/callback`
     - `https://7h-store-git-mejora-diseno-rendimiento-davidalexanderr44-6281.vercel.app/api/cuenta/google/callback`
     - `http://localhost:3000/api/cuenta/google/callback`
     - Cuando tengas dominio propio, agrega también `https://TU-DOMINIO/api/cuenta/google/callback`.
6. Copiar el ID y el secreto **directamente en Vercel**, sin pasar por el chat:
   - `GOOGLE_CLIENT_ID` (Production y Preview).
   - `GOOGLE_CLIENT_SECRET` (Production y Preview).
7. Volver a desplegar: Vercel → Deployments → Redeploy. Las variables nuevas solo aplican a despliegues nuevos.

Google Login **no se puede declarar funcionando** hasta completar el flujo real con una cuenta de Google en Preview.

## 4. Correos (Resend)

No hay `RESEND_API_KEY` ni `EMAIL_FROM` en ningún entorno. Mientras falten:

- No sale el código de 6 dígitos.
- No sale la verificación de correo, y sin correo verificado el cliente no ve sus pedidos.
- No sale la recuperación de contraseña.
- No salen los avisos de pedidos ni los de solicitudes.

Pasos:

1. Comprar un dominio.
2. En resend.com → Domains, agregar el dominio y crear los registros DNS que indique (SPF y DKIM).
3. Crear la API key.
4. En Vercel, configurar estas variables:
   - `RESEND_API_KEY`
   - `EMAIL_FROM="7H STORE <no-responder@tudominio.com>"`
   - `SUPPORT_INBOX_EMAIL="soporte@tudominio.com"`
5. Correo entrante (opcional): en Resend → Inbound y Webhook `email.received`, apuntar a `https://<sitio>/api/webhooks/correo-entrante`. Su secreto va en `RESEND_WEBHOOK_SECRET`.

## 5. Funciones: estado

Leyenda de "Probado":
- **auto:** prueba automática.
- **nav:** probado en el navegador.
- **—:** pendiente de entorno.

| Funcionalidad | Estado | Probado | Pendiente |
|---|---|---|---|
| Rastreo exige iniciar sesión (sin número de guía) | Listo | nav | — |
| Mis pedidos: muestra automáticamente los pedidos del correo verificado, incluidos los de invitado | Listo | auto | Probar con sesión en la base de pruebas |
| Separación entre clientes (no ver pedidos ajenos) | Listo | auto (pedido de otro correo da 404; sin correo verificado no se ve ninguno) | — |
| Registro y acceso con contraseña | Listo | auto | Correo de verificación (Resend) |
| Código de un solo uso (OTP): uso único, vence en 10 min, se bloquea tras 5 intentos | Listo | auto | Recepción real (Resend) |
| Antitoma de cuenta y un solo perfil por correo | Listo | auto | — |
| Google Login | Código listo | auto (PKCE, URI de regreso, errores) | Credenciales de Google y prueba real |
| Perfil, direcciones y solicitud de datos personales (Ley 1581) | Listo | compila; sin sesión redirige | Probar con sesión |
| Solicitudes: radicado, evidencias validadas por contenido, historial y notas internas | Listo | auto | Probar con sesión |
| Panel: bandeja de solicitudes y clientes | Listo | redirige al login de admin | Probar con sesión de administrador |
| Correo entrante asociado al radicado | Listo | auto (firma Svix) | Resend Inbound |
| Carrito vacío sin envío ni total | Listo | código | El "$18.000" solo existe en la versión publicada antigua |
| Envío: tarifa real de Envia con mínimo de $15.000 y "Calculando…" hasta tenerla | Listo | auto y código | — |
| Pagos: el precio y el envío se recalculan en el servidor; el pago lo confirma solo el webhook firmado | Listo | auto | Pago Sandbox en la base de pruebas |
| Página principal rediseñada | Listo | nav (escritorio y 375 px, sin desbordamiento horizontal) | Revisar en tu celular |

## 6. Errores corregidos en esta revisión

- **Versión de prueba con acceso a pagos reales:** ahora el pago se bloquea fuera de producción si la llave de Wompi es real.
- **Google en Preview:** la dirección de regreso apuntaba a producción.
- **Páginas privadas sin sesión:** generaban error en el servidor. Ahora cada página valida la sesión.
- **Checkout:** podía mostrar por un momento la tarifa por zona antes de la tarifa real. Ahora muestra "Calculando…".
- **Página principal:**
  - Se retiró la foto de la mujer con la flor.
  - Se retiró la foto de categoría con un logo de Nike visible. Las categorías ahora usan fotos de productos reales de la tienda.
  - Se retiró el texto "Tarifa única de $18.000", que ya no era cierto.

## 7. Resultados técnicos

- **TypeScript (`tsc --noEmit`):** sin errores.
- **ESLint:** sin errores ni advertencias.
- **Pruebas automáticas:** 213 de 213 pasan.
- **Build:** compila sin errores en local y en Vercel Preview.

## 8. Avisos sobre los datos actuales

- La base real contiene productos de ejemplo del seed (Garmin, Coach, Carhartt, New Balance y otros). Si no son productos que vendes de verdad, desactívalos en el panel antes de publicar.
- Pedido de prueba 7H-2026-AD612683: cancelarlo.

## 9. Requisitos para publicar

**Críticos (impiden lanzar):**
1. Base de datos de pruebas separada y prueba completa con sesión: registro, pedidos, solicitudes y panel.
2. Resend con dominio propio y recepción comprobada de los correos.
3. Llaves de Wompi de producción solo en Production, y un pago Sandbox completo comprobado en Preview.
4. Retirar los productos de ejemplo que no sean reales.

**Altos:**
5. Google Login con credenciales y flujo real comprobado.
6. Revisión legal de términos, privacidad y devoluciones por un abogado.

**Medios:**
7. Dominio propio y Supabase Pro (backups).
8. Fotos de campaña propias de la marca, para reemplazar las de Unsplash.

**Por último:** autorización expresa de David ("sí, publica") para unir la rama a `main`.
