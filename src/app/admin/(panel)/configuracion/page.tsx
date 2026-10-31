import { requireAdminPage } from "@/lib/admin/guard";
import { FLAT_SHIPPING_COP, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { formatCOP } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Configuración" };

const IS_PROD = process.env.NODE_ENV === "production";

/** [nombre, descripción, obligatoria] — nunca se muestra el valor, solo si existe. */
const VARS: [string, string, boolean][] = [
  ["DATABASE_URL", "Base de datos", true],
  ["NEXT_PUBLIC_SITE_URL", "Dominio público (enlaces de correos, sitemap, SEO)", true],
  ["ADMIN_SESSION_SECRET", "Firma de las sesiones del panel (32+ caracteres aleatorios)", IS_PROD],
  ["ADMIN_PASSWORD", "Llave de arranque: solo para crear el primer dueño en /admin/setup", false],
  ["WOMPI_PUBLIC_KEY", "Wompi · llave pública", true],
  ["WOMPI_INTEGRITY_SECRET", "Wompi · integridad (checkout)", true],
  ["WOMPI_EVENTS_SECRET", "Wompi · eventos (webhook)", true],
  ["SUPABASE_URL", "Supabase Storage · URL", false],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase Storage · llave de servicio (solo servidor)", false],
  ["CRON_SECRET", "Cron de expiración de pedidos", true],
  ["RESEND_API_KEY", "Correos a clientes (pedido, pago, envío) y recuperación de contraseña", false],
  ["EMAIL_FROM", "Remitente de los correos", false],
  ["ENVIA_API_TOKEN", "Envia · token de API (guías automáticas y tarifas reales)", false],
  ["ENVIA_ENV", "Envia · ambiente: sandbox (pruebas) o production", false],
  ["ENVIA_CARRIERS", "Envia · transportadoras a cotizar (p. ej. servientrega,coordinadora)", false],
  ["ENVIA_CHECKOUT_RATES", "Envia · \"1\" para cobrar en el checkout la tarifa real", false],
];

export default async function SettingsPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Configuración" subtitle="Solo lectura. Los valores nunca se muestran: únicamente si están configurados." />
      {IS_PROD && !process.env.ADMIN_SESSION_SECRET && (
        <p role="alert" className="mb-6 border border-error/40 bg-white p-4 text-sm text-error">Falta ADMIN_SESSION_SECRET: en producción las sesiones deben firmarse con un secreto propio, no derivado de ADMIN_PASSWORD.</p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Variables de entorno">
          <ul className="divide-y divide-ink/10">
            {VARS.map(([name, desc, required]) => {
              const ok = !!process.env[name];
              return <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span><span className="font-mono text-xs">{name}</span><span className="block text-[11px] text-ink-soft">{desc}</span></span><Badge tone={ok ? "success" : required ? "error" : "warning"}>{ok ? "Configurada" : required ? "Falta" : "Sin configurar"}</Badge></li>;
            })}
          </ul>
        </Card>
        <Card title="Reglas de la tienda">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Envío gratis desde</dt><dd>{formatCOP(FREE_SHIPPING_THRESHOLD)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Tarifa de envío</dt><dd>{formatCOP(FLAT_SHIPPING_COP)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Reserva de stock</dt><dd>24 horas</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-ink-soft">Estos valores viven en el código (<code>lib/shipping.ts</code>) para no alterar el cálculo de envío del checkout.</p>
        </Card>
      </div>
    </>
  );
}
