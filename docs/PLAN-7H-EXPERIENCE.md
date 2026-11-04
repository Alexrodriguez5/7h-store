# 7H STORE — Evolución integral (7H AURA Experience)

Diagnóstico y plan por fases. Todo se hace en ramas y PR separados; nada se publica sin tu clic en Merge.

## 1. Lo que ya existe y se reutiliza

| Necesidad | Ya existe | Cómo se reutiliza |
|---|---|---|
| Identidad visual | 7H AURA unificada (PR #7): PageHero, surface, glass, aura | Base de todas las páginas nuevas |
| Subir fotos | `src/lib/storage.ts` (Supabase Storage, clave privada solo en servidor) y `detectImageType` (valida bytes reales, no la extensión) | Mismo mecanismo, en un bucket separado para clientes |
| Límite de frecuencia | Tabla `RateLimit` y `src/lib/rate-limit.ts` | Reseñas, solicitudes, consultas y comunidad |
| Sesión de cliente | Google, código al correo y contraseña | Reseñas, votos, comunidad y consultas con cuenta |
| Mensajería con la tienda | `SupportRequest` + eventos + adjuntos + correos (Resend) | Garantías y PQR siguen igual; "Habla con 7H" usa un modelo hermano para consultas sin pedido |
| Panel admin | Roles, auditoría y sesión segura | Nuevas secciones dentro del mismo panel |

## 2. Cambios de base de datos (solo agregar, nada se borra ni se renombra)

Se aplican con `npm run db:push`, que solo crea tablas y columnas nuevas. Los pedidos, productos e inventario actuales no se tocan.

**Product (columnas nuevas, todas opcionales):** `model`, `material`, `color`, `origin` (solo si está confirmado), `condition`, `warranty`, `features[]`, `badges[]` (etiquetas que marca el administrador) y `videoUrl`.

**Tablas nuevas:**
- `Review` + `ReviewPhoto` + `ReviewVote`: calificación de 1 a 5, texto, fotos, estado (pendiente, aprobada, rechazada u oculta) y votos de "útil". La compra verificada la calcula el servidor (pedido pagado de ese producto con el mismo correo); el cliente no puede marcarla.
- `ProductRequest` ("Tú lo buscas. Nosotros lo exploramos"): datos del formulario, foto opcional, estado (nueva, en revisión, cotizando, disponible, no disponible o finalizada), respuesta y producto creado.
- `Inquiry` + `InquiryMessage` ("Habla con 7H STORE"): conversaciones persistentes con estado de atención y respuestas del administrador, con aviso por correo.
- `MediaItem` ("Así se vive 7H"): fotos y videos de la tienda o de clientes, con autorización de uso público, moderación y opción de retiro.
- Comunidad (fase 6): `CommunityPost`, `CommunityComment`, `CommunityReaction` y `CommunityReport`.

## 3. Etiquetas (sin afirmaciones falsas)

- **Automáticas, según los datos:** Disponible, Últimas unidades y Agotado (inventario), Oferta (precio anterior mayor al actual) y Nuevo (publicado hace menos de 30 días).
- **Manuales, desde el panel, solo si tú las confirmas:** Producto original, Importado de EE.UU., Garantía del fabricante y Edición limitada.
- **Condiciones de toda la tienda** (envío nacional, compra segura): se muestran una sola vez en la ficha, no en cada tarjeta.
- Si un dato no existe, la etiqueta y la fila de información no aparecen.

## 4. Seguridad

- Validación en el servidor con Zod.
- Fotos: JPG, PNG o WebP comprobados por sus bytes, 5 MB máximo y 4 por reseña. Se comprimen en el navegador antes de subirlas. Las pendientes no son públicas.
- Texto plano (React lo escapa, sin HTML). Se bloquean enlaces en reseñas y comentarios.
- Límite de frecuencia por persona e IP, campo trampa contra robots y moderación previa.
- Nada de datos privados en público: solo el alias o el nombre de pila con la inicial del apellido.

## 5. Librerías

No se instala ninguna. El 3D usa WebGL propio (ya existe). Las animaciones van con CSS e IntersectionObserver. La compresión de imágenes usa el canvas del navegador. Three.js, React Three Fiber, Drei, GSAP, Motion o Lenis sumarían entre 40 y 200 kB sin aportar algo que hoy falte.

## 6. Navegación (sin recargar el header)

- **Header:** Catálogo con sus categorías, buscador, **Tú lo buscas** (nuevo), Mi cuenta y Carrito.
- **Portada:** secciones "Así se vive 7H" (galería), "Tú lo buscas. Nosotros lo exploramos" y Comunidad.
- **Footer:** Comunidad, Habla con 7H, Preguntas frecuentes y Sobre 7H STORE.
- **Búsqueda sin resultados:** invita a usar "Tú lo buscas".

## 7. Fases y entregas (un PR por fase)

1. Etiquetas y ficha de información del producto, más la administración de etiquetas.
2. Reseñas verificadas con fotos, más su moderación.
3. Tú lo buscas: solicitud de productos, más su gestión en el panel.
4. Habla con 7H STORE: consultas y respuestas.
5. Galería "Así se vive 7H".
6. Comunidad 7H, en una versión básica.

En cada fase se ejecutan typecheck, lint, pruebas, build y una revisión en el navegador.
