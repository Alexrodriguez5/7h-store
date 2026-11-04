"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnGhost } from "./ui";

/** Mostrar u ocultar una pieza en la sección de la portada. */
export function FeatureToggle({ endpoint, featured }: { endpoint: string; featured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={btnGhost}
      onClick={async () => {
        setBusy(true);
        await adminFetch(endpoint, "PATCH", { featured: !featured });
        setBusy(false);
        router.refresh();
      }}
    >
      {featured ? "Quitar de la portada" : "Mostrar en la portada"}
    </button>
  );
}
