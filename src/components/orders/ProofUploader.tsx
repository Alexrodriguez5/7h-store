"use client";
import { useState } from "react";

/** Subida del comprobante de transferencia/consignación. Pide el correo del pedido como verificación. */
export function ProofUploader({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const form = e.currentTarget;
    const input = form.elements.namedItem("file");
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value.trim() ?? "";
    if (!email) return setMessage({ ok: false, text: "Escribe el correo con el que hiciste el pedido." });
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return setMessage({ ok: false, text: "Selecciona un comprobante." });
    if (input.files[0].size > 5 * 1024 * 1024) return setMessage({ ok: false, text: "El comprobante debe pesar máximo 5 MB." });
    const data = new FormData();
    data.append("file", input.files[0]);
    data.append("email", email);
    setLoading(true);
    setMessage(undefined);
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}/proof`, { method: "POST", body: data });
      const b = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      setMessage(r.ok ? { ok: true, text: b.message ?? "Comprobante recibido." } : { ok: false, text: b.error ?? "No pudimos recibir el comprobante." });
      if (r.ok) form.reset();
    } catch {
      setMessage({ ok: false, text: "No pudimos subir el comprobante. Revisa tu conexión." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-gold/20 pt-5" noValidate>
      <div>
        <label className="block text-xs font-semibold" htmlFor="proof-email">Correo del pedido</label>
        <input id="proof-email" name="email" type="email" autoComplete="email" required className="mt-2 w-full border border-ink/20 bg-transparent px-3 py-3 text-sm outline-none focus:border-gold" />
      </div>
      <div>
        <label className="block text-xs font-semibold" htmlFor="proof">Comprobante (JPG, PNG o PDF, máximo 5 MB)</label>
        <input id="proof" name="file" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-2 block w-full text-xs" />
      </div>
      <button disabled={loading} aria-busy={loading} className="bg-ink px-4 py-3 text-xs text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-50">
        {loading ? "Subiendo…" : "Subir comprobante"}
      </button>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-success" : "text-error"}`}>{message.text}</p>}
    </form>
  );
}
