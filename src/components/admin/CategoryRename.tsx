"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnGhost, inputCls } from "./ui";

export function CategoryRename({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [value, setValue] = useState(label);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const save = async () => {
    setBusy(true);
    setErr(undefined);
    const r = await adminFetch(`/api/admin/categories/${id}`, "PATCH", { label: value });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
  };
  return (
    <div>
      <div className="flex gap-2"><input aria-label="Nombre visible" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} max-w-[220px]`} />
        <button type="button" className={btnGhost} disabled={busy || value.trim() === label || value.trim().length < 2} onClick={save}>{busy ? "…" : "Guardar"}</button></div>
      {err && <p role="alert" className="mt-1 text-[11px] text-error">{err}</p>}
    </div>
  );
}
