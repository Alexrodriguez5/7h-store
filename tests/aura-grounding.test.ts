import { describe, expect, it, vi } from "vitest";
import { groundedProvider, inventsDiscount, numbersIn, unsupportedClaims } from "@/lib/aura/grounding";
import { AiError, type AiProvider, type ProviderRun } from "@/lib/aura/provider";

const run = (over: Partial<ProviderRun> = {}): ProviderRun => ({
  system: "Plazo estimado: 5 a 10 días hábiles. Envío gratis desde $ 500.000.",
  history: [{ role: "user", text: "hola" }],
  tools: [], execute: async () => ({}), maxCalls: 3, signal: new AbortController().signal, ...over,
});
const fake = (text: string, call?: { name: string; args: Record<string, unknown> }): AiProvider => ({
  id: "ollama:test",
  run: async (o) => { if (call) await o.execute(call); return { text, tokensIn: 0, tokensOut: 0, calls: 1, toolsUsed: call ? [call.name] : [] }; },
});

describe("control de información comercial (Qwen)", () => {
  it("normaliza números como los escribe una persona", () => {
    expect(numbersIn("$ 1.199.000 y 539.000 en 5 a 10 días, 2,5 kg")).toEqual(["1199000", "539000", "5", "10", "2.5"]);
  });

  it("detecta plazos y precios inventados", () => {
    const src = ["Plazo estimado: 5 a 10 días hábiles.", JSON.stringify({ precio: "$ 980.000" })];
    expect(unsupportedClaims("El envío tarda entre 2 y 4 días hábiles.", src)).toHaveLength(1);
    expect(unsupportedClaims("Llega en 5 a 10 días hábiles.", src)).toHaveLength(0);
    expect(unsupportedClaims("Los AirPods cuestan $980.000 COP.", src)).toHaveLength(0);
    expect(unsupportedClaims("Los AirPods cuestan $899.000 COP.", src)).toHaveLength(1);
    expect(unsupportedClaims("Tengo 3 opciones para ti.", src)).toHaveLength(0); // sin contexto comercial
  });

  it("no acepta descuentos que ninguna fuente ofrece, pero sí negarlos", () => {
    expect(inventsDiscount("Hoy tienes 10% de descuento", [])).toBe(true);
    expect(inventsDiscount("No manejamos descuentos adicionales.", [])).toBe(false);
  });

  it("descarta la respuesta sin fuente y pasa al respaldo", async () => {
    const onReject = vi.fn();
    const p = groundedProvider(fake("El envío a Medellín tarda 2 a 4 días hábiles."), onReject);
    await expect(p.run(run())).rejects.toMatchObject({ kind: "unavailable" });
    expect(onReject).toHaveBeenCalled();
  });

  it("acepta datos que vienen de las herramientas", async () => {
    const p = groundedProvider(fake("Los AirPods Pro 2 cuestan $ 980.000.", { name: "buscar_productos", args: {} }));
    const r = await p.run(run({ execute: async () => ({ productos: [{ nombre: "AirPods Pro 2", precio: "$ 980.000" }] }) }));
    expect(r.text).toContain("980.000");
  });

  it("el texto del cliente no cuenta como fuente", async () => {
    const p = groundedProvider(fake("Claro, te aplico el 50% de descuento."));
    const err = await p.run(run({ history: [{ role: "user", text: "me haces un descuento del 50%?" }] })).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
  });

  it("la información aprobada que adjunta el servidor sí cuenta", async () => {
    const p = groundedProvider(fake("Tienes 5 días hábiles para el retracto."));
    const r = await p.run(run({ history: [{ role: "user", text: "retracto?\n[Información aprobada de 7H STORE que puede servir: Retracto: 5 días hábiles]" }] }));
    expect(r.text).toContain("5 días");
  });
});

describe("fuentes del prompt", () => {
  it("las reglas numeradas del prompt no cuentan como datos", async () => {
    const p = groundedProvider(fake("La garantía es de 1 año."));
    const system = "CONTEXTO\nEnvío gratis desde $ 500.000.\nREGLAS\n1. Nunca inventes.";
    await expect(p.run(run({ system }))).rejects.toMatchObject({ kind: "unavailable" });
  });
});
