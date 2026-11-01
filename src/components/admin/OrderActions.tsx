"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { adminFetch } from "./api";
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";
import { EnviaLabelPanel } from "./EnviaLabelPanel";

interface Props { orderId: string; status: OrderStatus; isManualPayment: boolean; enviaEnabled?: boolean; carrier?: string | null; trackingNumber?: string | null }

export function OrderActions({ orderId, status, isManualPayment, enviaEnabled = false, carrier: savedCarrier, trackingNumber: savedTracking }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [carrier, setCarrier] = useState(savedCarrier ?? "");
  const [tracking, setTracking] = useState(savedTracking ?? "");
  const [restock, setRestock] = useState(true);

  const run = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch(`/api/admin/orders/${orderId}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setMsg({ ok: true, text: "Pedido actualizado." });
    router.refresh();
  };

  const cancelBtn = (
    <button type="button" disabled={busy} className={btnDanger}
      onClick={() => run({ action: "status", status: "CANCELLED", restock: status === "PENDING_PAYMENT" ? true : restock },
        status === "PENDING_PAYMENT" ? "¿Cancelar este pedido? Las unidades reservadas volverán al inventario." : `¿Cancelar este pedido ya pagado? ${restock ? "Las unidades volverán al inventario." : "El inventario NO se modificará."} El reembolso se gestiona aparte en Wompi/banco.`)}>
      Cancelar pedido
    </button>
  );

  const terminal = status === "DELIVERED" || status === "CANCELLED" || status === "EXPIRED";

  return (
    <div className="space-y-4">
      {terminal && <p className="text-sm text-ink-soft">Este pedido está en un estado final; no admite más cambios.</p>}

      {status === "PENDING_PAYMENT" && (
        <>
          {isManualPayment ? (
            <button type="button" disabled={busy} className={btnPrimary}
              onClick={() => run({ action: "confirm_manual_payment" }, "¿Confirmaste que el dinero ya está en la cuenta? Esto marcará el pago como aprobado y el pedido como pagado.")}>
              Confirmar pago manual
            </button>
          ) : (
            <p className="text-xs leading-5 text-ink-soft">El pago con tarjeta/PSE lo confirma Wompi automáticamente por webhook. No se puede marcar manualmente.</p>
          )}
          {cancelBtn}
        </>
      )}

      {status === "PAID" && (
        <>
          <button type="button" disabled={busy} className={btnPrimary} onClick={() => run({ action: "status", status: "PROCESSING" })}>Pasar a Preparando</button>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Al cancelar, devolver al inventario</label>
          {cancelBtn}
        </>
      )}

      {enviaEnabled && (status === "PAID" || status === "PROCESSING") && !savedTracking && (
        <EnviaLabelPanel orderId={orderId} onLabel={(c, t) => { setCarrier(c); setTracking(t); }} />
      )}

      {status === "PROCESSING" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} htmlFor="carrier">Transportadora</label><input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} placeholder="Servientrega, Coordinadora…" /></div>
            <div><label className={labelCls} htmlFor="tracking">Número de guía</label><input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} /></div>
          </div>
          <button type="button" disabled={busy || !carrier.trim() || !tracking.trim()} className={btnPrimary}
            onClick={() => run({ action: "status", status: "SHIPPED", carrier, trackingNumber: tracking }, "¿Marcar como enviado?")}>Marcar como enviado</button>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Al cancelar, devolver al inventario</label>
          {cancelBtn}
        </>
      )}

      {status === "SHIPPED" && (
        <button type="button" disabled={busy} className={btnGhost} onClick={() => run({ action: "status", status: "DELIVERED" }, "¿Marcar como entregado?")}>Marcar como entregado</button>
      )}

      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}
