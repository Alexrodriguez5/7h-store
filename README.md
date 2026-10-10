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

## 4. Scripts
- `npm run dev` desarrollo
- `npm run build` producción
- `npm run typecheck` TypeScript
- `npm run lint` ESLint
- `npm test` pruebas
- `npm run db:studio` Prisma Studio

## 5. Antes de producción
- Cambiar el almacenamiento demo del comprobante a Supabase Storage/S3.
- Sustituir el acceso `?key=` del admin por autenticación real.
- Configurar Wompi y validar su checksum con la configuración final de la cuenta.
- Añadir correo transaccional.
- Añadir rate limiting con infraestructura real.
- Revisar textos legales, tratamiento de datos, devoluciones y datos bancarios.

## 6. Abrir en Visual Studio Code
1. Descomprime el ZIP.
2. En VS Code elige **Archivo → Abrir carpeta** y selecciona la carpeta `7h-store`.
3. Abre la terminal integrada con **Terminal → Nueva terminal**.
4. Ejecuta `npm install`.
5. Crea `.env.local` desde `.env.example` y coloca tu `DATABASE_URL` de Supabase.
6. Ejecuta `npm run db:generate`, `npm run db:push`, `npm run db:seed`.
7. Ejecuta `npm run dev`.
8. Abre `http://localhost:3000`.

### Extensiones recomendadas
- ESLint — `dbaeumer.vscode-eslint`
- Prisma — `prisma.prisma`
- Tailwind CSS IntelliSense — `bradlc.vscode-tailwindcss`
- Prettier — `esbenp.prettier-vscode`

No necesitas instalar una extensión de Next.js ni una de React para que el proyecto funcione.
