import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { PasswordForm, PrivacyRequestForm, ProfileForm } from "@/components/account/ProfileForms";
import { Panel, Pill, fmtDate } from "@/components/account/ui";

export const metadata: Metadata = { title: "Mi perfil" };

const PROVIDERS: Record<string, string> = { google: "Google", password: "Correo y contraseña", email_otp: "Código por correo" };

export default async function ProfilePage() {
  const c = (await getCurrentCustomer())!;
  const identities = await prisma.customerIdentity.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "asc" }, select: { id: true, provider: true, createdAt: true } });

  return (
    <>
      <h1 className="font-display text-4xl">Mi perfil</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Datos personales">
          <ProfileForm name={c.name} phone={c.phone ?? ""} />
          <dl className="mt-6 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-soft">Correo</dt><dd className="flex items-center gap-2 font-medium">{c.email} {c.emailVerifiedAt ? <Pill tone="success">Verificado</Pill> : <Pill tone="warning">Sin verificar</Pill>}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-soft">Cliente desde</dt><dd>{fmtDate(c.createdAt)}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-ink-soft">El correo es la llave de tus pedidos y no se cambia desde aquí. Si necesitas cambiarlo, crea una solicitud o escríbenos por Contacto.</p>
        </Panel>

        <Panel title="Formas de ingresar">
          <ul className="space-y-2">
            {identities.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-2xl bg-ivory/80 px-4 py-3 text-sm">
                <span className="font-medium">{PROVIDERS[i.provider] ?? i.provider}</span>
                <span className="text-xs text-ink-soft">desde {fmtDate(i.createdAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-ink-soft">Todas entran a la misma cuenta porque usan el mismo correo. Siempre puedes ingresar con un código enviado a tu correo.</p>
          <div className="mt-6 border-t border-ink/10 pt-5">
            <h3 className="mb-3 text-sm font-semibold">{c.passwordHash ? "Cambiar contraseña" : "Crear contraseña"}</h3>
            {c.emailVerifiedAt ? <PasswordForm hasPassword={Boolean(c.passwordHash)} /> : <p className="text-sm text-ink-soft">Confirma tu correo para crear una contraseña.</p>}
          </div>
        </Panel>
      </div>

      <Panel title="Tus datos personales">
        <p className="text-sm leading-6 text-ink-soft">
          Según la Ley 1581 de 2012 puedes conocer, actualizar, rectificar o pedir la supresión de tus datos. Respondemos en máximo 15 días hábiles.
          La información de tus pedidos se conserva el tiempo que exige la ley por obligaciones contables.
        </p>
        {c.deletionRequestedAt && <p className="mt-3 text-sm"><Pill tone="warning">Supresión solicitada el {fmtDate(c.deletionRequestedAt)}</Pill></p>}
        <div className="mt-5">{c.emailVerifiedAt ? <PrivacyRequestForm /> : <p className="text-sm text-ink-soft">Confirma tu correo para enviar esta solicitud.</p>}</div>
      </Panel>
    </>
  );
}
