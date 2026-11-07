import { redirect } from "next/navigation";

/** La bandeja anterior de "Tú lo buscas" ahora vive en Solicitudes especiales (mismas solicitudes, más herramientas). */
export default function LegacyProductRequests() {
  redirect("/admin/solicitudes-especiales");
}
