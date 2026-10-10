# 7H STORE — Rediseño UX/UI del catálogo

## Cambios realizados
- Eliminada la barra de búsqueda duplicada dentro del catálogo. La búsqueda principal queda en el Header.
- Eliminados los botones de categorías duplicados dentro del catálogo; las categorías quedan como navegación principal.
- Filtros reorganizados por función: género, accesorios, precio y orden.
- Contador de resultados y filtros activos agrupados en una zona de resumen.
- Estado activo de categorías del Header corregido para reflejar la URL actual.
- Búsqueda del Header sincronizada con `?q=` cuando se navega al catálogo.
- Grid de productos con espaciado más uniforme y mejor jerarquía visual.
- Se conserva la lógica de filtros mediante URL y no se modifica la lógica de pagos, Wompi, Prisma, Supabase, checkout, pedidos ni APIs.
- Se mantienen los tokens de marca y las reglas de accesibilidad existentes.

## Archivos UI modificados
- `src/app/catalogo/page.tsx`
- `src/components/catalog/Catalog.tsx`
- `src/components/catalog/FilterBar.tsx`
- `src/components/layout/Header.tsx`

## Seguridad
- No se incluye `.env` en este paquete.
- No se incluye `.next` ni `node_modules`.
