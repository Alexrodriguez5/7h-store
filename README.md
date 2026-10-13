# 7H STORE

MVP avanzado de tienda colombiana con Next.js App Router, TypeScript estricto, Tailwind CSS v4, Zustand, Zod, React Hook Form, Prisma y PostgreSQL/Supabase.

## 1. Instalar
Requiere Node.js 20.9+ recomendado.

```bash
npm install
```

Copia `.env.example` a `.env.local` y completa `DATABASE_URL`. En Windows PowerShell puedes usar:

```powershell
Copy-Item .env.example .env.local
```

Luego:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`.

## 2. Base de datos
El acceso a productos y pedidos pasa por `src/services/` y Prisma. El esquema está en `prisma/schema.prisma` y el seed crea 16 productos variados.

## 3. Pagos
Tarjeta/PSE usan `PaymentGateway` con implementación de ejemplo Wompi. El navegador nunca marca un pedido como pagado: el webhook `/api/webhooks/wompi` verifica la firma antes de actualizar el pedido. Transferencia/consignación quedan pendientes y aceptan comprobante.

## 4. Panel administrativo (/admin)
- Primera vez: `npm run db:push` y abre `/admin/setup`. Usa el valor de `ADMIN_PASSWORD` como *llave de arranque* para crear la cuenta del dueño. Después, esa página se bloquea.
- Cada persona tiene su propia cuenta (Panel → Usuarios). No hay registro público.
- Categorías, productos, imágenes, inventario por talla, pedidos y auditoría se gestionan desde el panel.
- Emergencias (sin correo configurado): `npm run admin -- restablecer correo@dominio.com`.
- Detalle de la seguridad y de los cambios: `CAMBIOS-PRODUCCION.md`.

## 5. Scripts
- `npm run dev` desarrollo
- `npm run build` producción
- `npm run typecheck` TypeScript
- `npm run lint` ESLint
- `npm test` pruebas (base de datos en memoria; no tocan Supabase ni Wompi)
- `npm run db:studio` Prisma Studio
- `npm run admin -- listar` cuentas administrativas

## 6. Antes de producción
Sigue `PRODUCCION.md` (dominio, variables, Supabase, Wompi, cron, pruebas de compra, legal).

## 7. Abrir en Visual Studio Code
1. Descomprime el ZIP.
2. En VS Code elige **Archivo → Abrir carpeta** y selecciona la carpeta `7h-store`.
3. Abre la terminal integrada con **Terminal → Nueva terminal**.
4. Ejecuta `npm install`.
5. Crea `.env.local` y `.env` desde `.env.example` (mismos valores) y coloca tu `DATABASE_URL` de Supabase.
6. Ejecuta `npm run db:generate`, `npm run db:push`, `npm run db:seed`.
7. Ejecuta `npm run dev`.
8. Abre `http://localhost:3000`.

### Extensiones recomendadas
- ESLint — `dbaeumer.vscode-eslint`
- Prisma — `prisma.prisma`
- Tailwind CSS IntelliSense — `bradlc.vscode-tailwindcss`
- Prettier — `esbenp.prettier-vscode`

No necesitas instalar una extensión de Next.js ni una de React para que el proyecto funcione.
