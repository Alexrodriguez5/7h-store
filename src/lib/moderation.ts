import type { ModerationStatus } from "@prisma/client";

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  OCULTA: "Oculta",
};
export const MODERATION_ORDER: ModerationStatus[] = ["PENDIENTE", "APROBADA", "OCULTA", "RECHAZADA"];
export const moderationTone = (s: ModerationStatus) => (s === "APROBADA" ? "success" : s === "PENDIENTE" ? "warning" : s === "RECHAZADA" ? "error" : "neutral") as "success" | "warning" | "error" | "neutral";
