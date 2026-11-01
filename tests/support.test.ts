// @vitest-environment node
/** Solicitudes y garantías: radicado, propiedad del pedido, evidencias y acciones del equipo (base en memoria). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createFakeDb } from "./helpers/fake-db";

const h = vi.hoisted(() => ({ f: undefined as unknown as ReturnType<typeof createFakeDb>, mails: [] as { to: string; kind: string; paragraphs: string[] }[] }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.f.db; } }));
vi.mock("@/lib/mailer", () => ({ deliverLater: (m: { to: string; kind: string; paragraphs: string[] }) => h.mails.push(m), supportInbox: () => "soporte@7h.test" }));

import { SupportError, addCustomerMessage, applyStaffAction, createSupportRequest, customerOrdersWhere, validateEvidence } from "@/lib/services/support";
import { addBusinessDays, detectEvidenceType, supportCode } from "@/lib/support";

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
const db = () => h.f.db as unknown as PrismaClient;

const ana = { id: "c1", email: "ana@correo.co", emailVerifiedAt: new Date(), name: "Ana", phone: null } as never;
const base = { orderCode: "7H-K4M9QX", type: "DEFECTUOSO" as const, reason: "Suela despegada", description: "Llegó con la suela despegada.", items: [{ orderItemId: "it1", quantity: 1 }] };

beforeEach(() => {
  h.f = createFakeDb();
  h.mails = [];
  h.f.state.customer.push({ ...(ana as object) });
  h.f.state.order.push({ id: "o1", publicCode: "7H-K4M9QX", customerEmail: "ana@correo.co", status: "DELIVERED", totalCOP: 120000, createdAt: new Date() });
  h.f.state.order.push({ id: "o2", publicCode: "7H-ZZZZZZ", customerEmail: "otro@correo.co", status: "DELIVERED", totalCOP: 90000, createdAt: new Date() });
  h.f.state.orderItem.push({ id: "it1", orderId: "o1", name: "Tenis", size: "40", quantity: 2, unitPriceCOP: 60000 });
  h.f.state.orderItem.push({ id: "it2", orderId: "o2", name: "Gorra", size: null, quantity: 1, unitPriceCOP: 90000 });
});

describe("reglas de solicitudes", () => {
  it("radicado con formato SOL-AAAA-000001", () => expect(supportCode(2026, 42)).toBe("SOL-2026-000042"));
  it("suma días hábiles saltando fines de semana", () => {
    const friday = new Date(2026, 9, 30); // viernes 30 oct 2026
    expect(addBusinessDays(friday, 1).getDay()).toBe(1); // lunes
    expect(addBusinessDays(friday, 5).getDate()).toBe(6); // viernes 6 nov
  });
  it("detecta el tipo real del archivo por sus bytes", () => {
    expect(detectEvidenceType(JPG)?.mime).toBe("image/jpeg");
    expect(detectEvidenceType(PDF)).toBeNull();
  });
  it("rechaza archivos que no son foto o video y los que superan 4 MB", () => {
    expect(() => validateEvidence([{ name: "factura.pdf", bytes: PDF }])).toThrow(SupportError);
    const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set(JPG);
    expect(() => validateEvidence([{ name: "foto.jpg", bytes: big }])).toThrow(/4 MB/);
  });
  it("sin correo verificado no se ve ningún pedido", () => {
    expect(customerOrdersWhere({ email: "a@b.co", emailVerifiedAt: null })).toEqual({ id: "__ninguno__" });
  });
});

describe("crear solicitud", () => {
  it("crea radicados consecutivos, guarda evidencia y avisa por correo", async () => {
    const a = await createSupportRequest(ana, base, [{ name: "foto.jpg", bytes: JPG }], db());
    const b = await createSupportRequest(ana, { ...base, type: "OTRO", items: [] }, [], db());
    const year = new Date().getFullYear();
    expect(a.code).toBe(`SOL-${year}-000001`);
    expect(b.code).toBe(`SOL-${year}-000002`);
    expect(h.f.state.supportAttachment).toHaveLength(1);
    expect(h.f.state.supportAttachment[0].mime).toBe("image/jpeg");
    expect(h.f.state.supportEvent[0]).toMatchObject({ kind: "created", visibleToCustomer: true });
    expect(h.mails.some((m) => m.to === "ana@correo.co" && m.kind === "support.created")).toBe(true);
  });
  it("no permite usar el pedido de otra persona", async () => {
    await expect(createSupportRequest(ana, { ...base, orderCode: "7H-ZZZZZZ", items: [{ orderItemId: "it2", quantity: 1 }] }, [], db())).rejects.toMatchObject({ status: 404 });
  });
  it("no permite pedir más unidades de las compradas ni productos de otro pedido", async () => {
    await expect(createSupportRequest(ana, { ...base, items: [{ orderItemId: "it1", quantity: 3 }] }, [], db())).rejects.toThrow(/supera/);
    await expect(createSupportRequest(ana, { ...base, items: [{ orderItemId: "it2", quantity: 1 }] }, [], db())).rejects.toThrow(/no pertenece/);
  });
  it("exige elegir producto cuando el tipo lo requiere", async () => {
    await expect(createSupportRequest(ana, { ...base, items: [] }, [], db())).rejects.toThrow(/al menos un producto/);
  });
  it("un cliente sin correo verificado no puede crear solicitudes", async () => {
    await expect(createSupportRequest({ ...(ana as object), emailVerifiedAt: null } as never, base, [], db())).rejects.toMatchObject({ status: 403 });
  });
});

describe("acciones del equipo", () => {
  const seed = async () => (await createSupportRequest(ana, base, [], db())).code;

  it("no aprobar exige explicar el motivo al cliente", async () => {
    const code = await seed();
    await expect(applyStaffAction(code, "adm1", { status: "NO_APROBADA" }, db())).rejects.toThrow(/motivo/);
  });
  it("la nota interna nunca es visible ni se envía al cliente", async () => {
    const code = await seed();
    h.mails = [];
    await applyStaffAction(code, "adm1", { status: "EN_REVISION", note: "Cliente frecuente, revisar con bodega", message: "Estamos revisando tu caso." }, db());
    const note = h.f.state.supportEvent.find((e) => e.kind === "note");
    expect(note?.visibleToCustomer).toBe(false);
    expect(h.f.state.supportEvent.find((e) => e.kind === "message")?.visibleToCustomer).toBe(true);
    const sent = JSON.stringify(h.mails.filter((m) => m.to === "ana@correo.co"));
    expect(sent).toContain("Estamos revisando tu caso.");
    expect(sent).not.toContain("bodega");
  });
  it("registrar un reembolso solo deja constancia y avisa al cliente", async () => {
    const code = await seed();
    await applyStaffAction(code, "adm1", { status: "REEMBOLSO_EN_PROCESO", refundAmountCOP: 60000, refundReference: "WMP-123" }, db());
    expect(h.f.state.supportRequest[0]).toMatchObject({ refundAmountCOP: 60000, refundReference: "WMP-123", status: "REEMBOLSO_EN_PROCESO" });
    expect(h.f.state.supportEvent.some((e) => e.kind === "refund" && e.visibleToCustomer)).toBe(true);
  });
  it("si el equipo pidió información, la respuesta del cliente reabre la revisión", async () => {
    const code = await seed();
    await applyStaffAction(code, "adm1", { status: "INFO_SOLICITADA", message: "Envía una foto de la guía." }, db());
    await addCustomerMessage(ana, code, "Aquí está la foto.", [{ name: "guia.jpg", bytes: JPG }], db());
    expect(h.f.state.supportRequest[0].status).toBe("EN_REVISION");
  });
  it("un cliente no puede escribir en la solicitud de otro", async () => {
    const code = await seed();
    const otro = { id: "c2", email: "otro@correo.co", emailVerifiedAt: new Date(), name: "Otro" } as never;
    await expect(addCustomerMessage(otro, code, "hola", [], db())).rejects.toBeInstanceOf(SupportError);
  });
});
