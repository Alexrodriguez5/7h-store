import { requireAdminPage } from "@/lib/admin/guard";
import { FLAT_SHIPPING_COP, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { formatCOP } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Configuración" };

const VARS: [string, string, boolean][] = [
  ["DATABASE_URL", "Base de datos", true], ["ADMIN_PASSWORD", "Acceso administrativo", true], ["ADMIN_SESSION_SECRET", "Firma de sesión (recomendado)", false],
  ["WOMPI_PUBLIC_KEY", "Wompi · llave pública", true], ["WOMPI_INTEGRITY_SECRET", "Wompi · integridad", true], ["WOMPI_EVENTS_SECRET", "Wompi · eventos (webhook)", true],
  ["SUPABASE_URL", "Supabase Storage · URL", false], ["SUPABASE_SERVICE_ROLE_KEY", "Supabase Storage · llave de servicio", false], ["CRON_SECRET", "Cron de expiración", true],
];

export default async function SettingsPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Configuración" subtitle="Solo lectura. Los valores nunca se muestran: únicamente si están configurados." />
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
