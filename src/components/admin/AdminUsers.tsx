"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { Badge, btnDanger, btnGhost, btnPrimary, fmtDate, inputCls, labelCls, tdCls, thCls } from "./ui";

export interface AdminRow { id: string; name: string; email: string; role: "OWNER" | "ADMIN"; active: boolean; lastLoginAt: string | null; activeSessions: number }

export function AdminUsers({ rows, meId }: { rows: AdminRow[]; meId: string }) {
  const router = useRouter();
  return (
    <div className="space-y-8">
      <NewAdminForm onCreated={() => router.refresh()} />
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[880px]">
          <caption className="sr-only">Cuentas administrativas</caption>
          <thead className="border-b border-ink/10"><tr><th className={thCls}>Nombre</th><th className={thCls}>Rol</th><th className={thCls}>Estado</th><th className={thCls}>Último acceso</th><th className={thCls}>Acciones</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((r) => <AdminUserRow key={r.id} row={r} isMe={r.id === meId} onChanged={() => router.refresh()} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewAdminForm({ onCreated }: { onCreated: () => void }) {
  const [v, setV] = useState({ name: "", email: "", role: "ADMIN", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch("/api/admin/users", "POST", v);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setMsg({ ok: true, text: `Cuenta creada para ${v.email}. Entrégale la contraseña temporal por un canal privado y pídele cambiarla en «Mi cuenta».` });
    setV({ name: "", email: "", role: "ADMIN", password: "" });
    onCreated();
  };
  return (
    <form onSubmit={submit} className="grid gap-4 border border-ink/10 bg-white p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_160px_1fr_auto] xl:items-end" noValidate>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft md:col-span-2 xl:col-span-5">Invitar administrador</h2>
      <div><label htmlFor="au-name" className={labelCls}>Nombre</label><input id="au-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} /></div>
      <div><label htmlFor="au-email" className={labelCls}>Correo</label><input id="au-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={inputCls} /></div>
      <div><label htmlFor="au-role" className={labelCls}>Rol</label><select id="au-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} className={inputCls}><option value="ADMIN">Administrador</option><option value="OWNER">Dueño</option></select></div>
      <div><label htmlFor="au-pw" className={labelCls}>Contraseña temporal (12+)</label><input id="au-pw" type="text" autoComplete="off" required minLength={12} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className={`${inputCls} font-mono`} /></div>
      <button type="submit" disabled={busy || !v.name || !v.email || v.password.length < 12} aria-busy={busy} className={btnPrimary}>{busy ? "Creando…" : "Crear cuenta"}</button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs md:col-span-2 xl:col-span-5 ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </form>
  );
}

function AdminUserRow({ row, isMe, onChanged }: { row: AdminRow; isMe: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const act = async (body: Record<string, unknown>, confirmText?: string, okText = "Listo.") => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch(`/api/admin/users/${row.id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setMsg({ ok: true, text: okText });
    onChanged();
  };
  const resetPw = () => {
    const pw = window.prompt(`Nueva contraseña temporal para ${row.email} (mínimo 12 caracteres). Se cerrarán todas sus sesiones.`);
    if (pw === null) return;
    if (pw.length < 12) return setMsg({ ok: false, text: "La contraseña debe tener al menos 12 caracteres." });
    act({ action: "reset_password", password: pw }, undefined, "Contraseña restablecida. Entrégala por un canal privado.");
  };
  return (
    <tr className={row.active ? "" : "bg-ivory-200/40"}>
      <td className={tdCls}><span className="font-semibold">{row.name}</span>{isMe && <span className="ml-2 text-[11px] text-ink-soft">(tú)</span>}<span className="block text-[11px] text-ink-soft">{row.email}</span></td>
      <td className={tdCls}><Badge tone={row.role === "OWNER" ? "gold" : "neutral"}>{row.role === "OWNER" ? "Dueño" : "Administrador"}</Badge></td>
      <td className={tdCls}><Badge tone={row.active ? "success" : "neutral"}>{row.active ? "Activo" : "Desactivado"}</Badge><span className="block text-[11px] text-ink-soft">{row.activeSessions} sesión(es) abierta(s)</span></td>
      <td className={tdCls}>{row.lastLoginAt ? fmtDate(row.lastLoginAt) : "Nunca"}</td>
      <td className={tdCls}>
        {isMe ? <span className="text-xs text-ink-soft">Gestiona tu cuenta en «Mi cuenta».</span> : (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} className={btnGhost} onClick={() => act({ action: "role", role: row.role === "OWNER" ? "ADMIN" : "OWNER" }, `¿Cambiar el rol de ${row.email}?`)}>{row.role === "OWNER" ? "Hacer administrador" : "Hacer dueño"}</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={resetPw}>Restablecer contraseña</button>
            <button type="button" disabled={busy || row.activeSessions === 0} className={btnGhost} onClick={() => act({ action: "revoke_sessions" }, `¿Cerrar todas las sesiones de ${row.email}?`)}>Cerrar sesiones</button>
            <button type="button" disabled={busy} className={row.active ? btnDanger : btnGhost} onClick={() => act({ action: row.active ? "deactivate" : "activate" }, row.active ? `¿Desactivar a ${row.email}? Perderá el acceso de inmediato.` : undefined)}>{row.active ? "Desactivar" : "Activar"}</button>
          </div>
        )}
        {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 max-w-sm text-[11px] ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
      </td>
    </tr>
  );
}
