# Checklist para publicar 7H STORE en un dominio propio

Marca cada punto antes de activar ventas reales. **Wompi en producción lo activas tú**: el código no cambia de ambiente por sí solo.

## 1. Dominio y hosting
- [ ] Compra el dominio (por ejemplo, `7hstore.co`) y apúntalo al hosting (Vercel recomendado para Next.js: *Settings → Domains*).
- [ ] HTTPS activo. Vercel lo emite solo; con un servidor propio, usa un certificado Let's Encrypt.
- [ ] `NEXT_PUBLIC_SITE_URL=https://tudominio.co`, sin barra al final.
- [ ] Redirección de `www` al dominio principal (o al revés), siempre la misma.

## 2. Variables de entorno de producción (en el panel del hosting, nunca en GitHub)
- [ ] `DATABASE_URL` (Supabase *Session pooler*; con *Transaction pooler* en el puerto 6543 agrega `?pgbouncer=true`).
- [ ] `ADMIN_SESSION_SECRET` (32+ caracteres aleatorios, **distinto** del de desarrollo).
- [ ] `ADMIN_PASSWORD`: solo hace falta mientras creas el primer dueño. Después puedes cambiarla por otra larga o borrarla.
- [ ] `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` (las **de producción**, cuando decidas cobrar de verdad).
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- [ ] `RESEND_API_KEY` y `EMAIL_FROM` (dominio verificado en Resend: registros SPF y DKIM en tu DNS).
- [ ] `BANK_*` con los datos reales de la cuenta.
- [ ] Rotar **todas** las credenciales que alguna vez estuvieron en un ZIP o en un chat.

## 3. Base de datos (Supabase)
- [ ] Respaldo antes de cada cambio de esquema: exporta las tablas a CSV desde Table Editor. En el plan Pro, revisa *Database → Backups* o PITR.
- [ ] `npm run db:push`. Los cambios de esta versión solo agregan columnas y tablas. Si aparece una advertencia de pérdida de datos, **detente**.
- [ ] Ejecuta `prisma/sql/stock-constraints.sql` (el stock nunca queda negativo).
- [ ] Ejecuta `prisma/sql/enable-rls.sql` (bloquea la API pública de Supabase; Prisma sigue funcionando).
- [ ] Ensaya una restauración: importa los CSV en un proyecto de prueba.
- [ ] Proyecto en un plan que no se pause por inactividad. Los proyectos gratuitos se pausan.

## 4. Almacenamiento de imágenes
- [ ] Bucket `product-images` **público** (solo lectura). La escritura solo se hace con la `service_role key`, desde el servidor.
- [ ] Opcional: límite de tamaño de 5 MB y tipos MIME `image/jpeg,image/png,image/webp` en la configuración del bucket.

## 5. Wompi
- [ ] Cuenta verificada para producción.
- [ ] "URL de Eventos" de **producción**: `https://tudominio.co/api/webhooks/wompi`.
- [ ] Compra real de bajo valor. En los logs del hosting debe aparecer `[wompi-webhook] 7H-… APPROVED → paid`, y el pedido debe quedar "Pagado" en `/admin`.
- [ ] Prueba un pago rechazado y verifica que el pedido siga pendiente.

## 6. Cron de expiración (cada 15–60 min)
- [ ] Vercel: crea `vercel.json` con `{"crons":[{"path":"/api/cron/expire-orders","schedule":"*/30 * * * *"}]}` (Vercel envía `Authorization: Bearer $CRON_SECRET`).
- [ ] Otro hosting: usa un servicio externo (cron-job.org, GitHub Actions) con la cabecera `Authorization: Bearer <CRON_SECRET>`.
- [ ] Verifica que un pedido vencido pase a "Expirado" y que su stock vuelva.

## 7. Pruebas de compra completas (Sandbox primero, luego producción)
- [ ] Tarjeta aprobada → Pagado → Preparando → Enviado (con guía) → Entregado.
- [ ] Tarjeta rechazada → sigue pendiente y expira a las 24 h.
- [ ] PSE.
- [ ] Transferencia: subir comprobante (con el correo del pedido) → aparece en "Comprobantes por revisar" → confirmar pago manual.
- [ ] Cancelar un pedido pendiente: el stock vuelve.
- [ ] Talla agotada: no se puede agregar al carrito ni comprar llamando a la API.
- [ ] Dos compras simultáneas de la última unidad: solo una se completa.

## 8. Panel administrativo
- [ ] Dueño creado en `/admin/setup`; la página queda bloqueada después.
- [ ] Cada persona con su propia cuenta (*Usuarios*). Nadie comparte contraseñas.
- [ ] Prueba la recuperación de contraseña por correo.
- [ ] Revisa *Auditoría* después de las pruebas.

## 9. Seguridad
- [ ] `npm audit` sin vulnerabilidades altas sin resolver.
- [ ] F12 → Consola en la tienda y en el panel: sin errores de *Content-Security-Policy*.
- [ ] `https://securityheaders.com` con tu dominio: CSP, HSTS, X-Frame-Options y nosniff presentes.
- [ ] Ninguna variable secreta con prefijo `NEXT_PUBLIC_`.
- [ ] `.env` y `.env.local` fuera de Git (`git status` no debe mostrarlos).

## 10. Registro de errores y monitoreo
- [ ] Revisa los logs del hosting (Vercel → *Logs*). Los mensajes clave empiezan con `[wompi-webhook]`, `[orders]`, `[admin]`, `[rate-limit]` y `[audit]`.
- [ ] Opcional: Sentry para errores y un monitor de disponibilidad (UptimeRobot) para `/` y `/api/webhooks/wompi` (la segunda debe responder 405 a un GET y 400 a un POST vacío, nunca 5xx).

## 11. SEO y contenido
- [ ] `https://tudominio.co/sitemap.xml` y `/robots.txt` responden (`/admin` y `/api` están excluidos).
- [ ] Registra el sitio en Google Search Console y envía el sitemap.
- [ ] Título y descripción revisados en `src/app/layout.tsx`. Imagen para compartir (Open Graph) opcional.
- [ ] Página 404 personalizada (ya existe).

## 12. Legal (Colombia)
- [ ] `/terminos` y `/privacidad` completos (sin [corchetes]) y revisados por un abogado.
- [ ] `/devoluciones` con derecho de retracto (5 días hábiles), garantía y procedimiento.
- [ ] `/envios` con plazos y costos reales.
- [ ] `/contacto` con correo y teléfono o WhatsApp, además de Instagram.
- [ ] Cookies: hoy solo hay técnicas (carrito y sesión del panel). Si agregas analítica o píxeles, actualiza la política y considera un aviso de cookies.
