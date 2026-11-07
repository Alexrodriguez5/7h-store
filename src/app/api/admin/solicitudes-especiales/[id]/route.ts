import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProductRequestStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { REQUEST_STATUS_ORDER } from "@/lib/services/product-requests";
import {
  RequestError, addNote, adminMessage, alternativeInput, assign, changeStatus, deleteAlternative, editStructured, offerInput,
  prepareOffer, revokeAccessTokens, saveAlternative, sendProposal, structuredInput,
} from "@/lib/services/special-requests";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(REQUEST_STATUS_ORDER as [ProductRequestStatus, ...ProductRequestStatus[]]), note: z.string().trim().max(600).optional() }),
  z.object({ action: z.literal("note"), body: z.string().trim().min(2).max(2000) }),
  z.object({ action: z.literal("message"), body: z.string().trim().min(2).max(2000) }),
  z.object({ action: z.literal("edit"), data: structuredInput }),
  z.object({ action: z.literal("assign"), adminId: z.string().max(40).nullable() }),
  z.object({ action: z.literal("alternative"), alternativeId: z.string().max(40).nullable(), data: alternativeInput }),
  z.object({ action: z.literal("deleteAlternative"), alternativeId: z.string().max(40) }),
  z.object({ action: z.literal("sendProposal"), message: z.string().trim().max(1500).optional() }),
  z.object({ action: z.literal("offer"), data: offerInput }),
  z.object({ action: z.literal("revokeLinks") }),
]);

/** Todas las acciones del expediente. Cada una exige sesión de administrador y queda en la auditoría. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = action.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  const exists = await prisma.productRequest.findUnique({ where: { id }, select: { code: true } });
  if (!exists) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  const a = parsed.data;
  const me = g.ctx.admin.id;
  try {
    let result: unknown = { ok: true };
    switch (a.action) {
      case "status": await changeStatus(id, a.status, me, a.note || null); break;
      case "note": await addNote(id, me, a.body); break;
      case "message": await adminMessage(id, me, a.body); break;
      case "edit": await editStructured(id, me, a.data); break;
      case "assign": await assign(id, me, a.adminId); break;
      case "alternative": result = { id: (await saveAlternative(id, me, a.data, a.alternativeId)).id }; break;
      case "deleteAlternative": await deleteAlternative(id, a.alternativeId); break;
      case "sendProposal": await sendProposal(id, me, a.message || null); break;
      case "offer": result = await prepareOffer(id, me, a.data); break;
      case "revokeLinks": await revokeAccessTokens(id); break;
    }
    await audit({ action: "product_request.updated", adminId: me, actorEmail: g.ctx.admin.email, entityType: "product_request", entityId: exists.code, details: { action: a.action }, ip: g.ctx.ip });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RequestError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[solicitudes-especiales]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 });
  }
}
