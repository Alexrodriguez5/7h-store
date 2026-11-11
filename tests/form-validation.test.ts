import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { addressInput } from "@/lib/customer/addresses";
import { inquiryInput } from "@/lib/services/inquiries";
import { productRequestInput } from "@/lib/services/product-requests";
import { adminUserInput } from "@/lib/schemas/admin";
import {
  MSG, addressText, checkDocument, cityName, coMobile, emailField, freeText, moneyCOP, optionalIntlPhone, optionalMobile, personName, quantity, sanitize,
} from "@/lib/validation/fields";

const order = {
  customer: { fullName: "María José Pérez", email: "maria@example.com", phone: "3001234567", documentType: "CC", documentNumber: "1020304050" },
  shipping: { department: "Antioquia", city: "Medellín", address: "Calle 10 # 20-30, apto 301", neighborhood: "El Poblado", notes: "Portería" },
  paymentMethod: "card",
  terms: true,
  items: [{ productId: "p1", size: "M", quantity: 1 }],
};
const withCustomer = (c: Partial<typeof order.customer>) => ({ ...order, customer: { ...order.customer, ...c } });
const withShipping = (s: Partial<typeof order.shipping>) => ({ ...order, shipping: { ...order.shipping, ...s } });
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("sanitize: mientras se escribe o se pega", () => {
  it("celular: quita letras y avisa; espacios, guiones y paréntesis se quitan sin aviso", () => {
    expect(sanitize("phone", "300abc1234567")).toEqual({ value: "3001234567", rejected: MSG.phoneChars });
    expect(sanitize("phone", "300 123-45 67")).toEqual({ value: "3001234567", rejected: null });
    expect(sanitize("phone", "(300) 123 4567")).toEqual({ value: "3001234567", rejected: null });
  });
  it("celular: conserva el + solo al inicio (pegado con +57) y limita la longitud", () => {
    expect(sanitize("phone", "+57 300 123 4567").value).toBe("+573001234567");
    expect(sanitize("phone", "300+1234567")).toEqual({ value: "3001234567", rejected: MSG.phoneChars });
    expect(sanitize("phone", "30012345678999").value).toBe("3001234567");
  });
  it("documento CC/CE: solo dígitos; puntos y espacios de formato se quitan sin aviso", () => {
    expect(sanitize("doc:CC", "1.020.304.050")).toEqual({ value: "1020304050", rejected: null });
    expect(sanitize("doc:CC", "10A20-30")).toEqual({ value: "102030", rejected: MSG.doc });
    expect(sanitize("doc:CE", "12345678901234").value).toBe("1234567890");
  });
  it("pasaporte: admite letras y números (en mayúsculas), no símbolos", () => {
    expect(sanitize("doc:PASAPORTE", "ab123456")).toEqual({ value: "AB123456", rejected: null });
    expect(sanitize("doc:PASAPORTE", "AB-12#34")).toEqual({ value: "AB1234", rejected: MSG.doc });
  });
  it("NIT: admite el guion del dígito de verificación", () => {
    expect(sanitize("doc:NIT", "900.123.456-7")).toEqual({ value: "900123456-7", rejected: null });
  });
  it("nombre: letras con tildes, ñ, espacios, guion y apóstrofe; quita números y símbolos", () => {
    expect(sanitize("name", "José Ñúñez-O'Neil")).toEqual({ value: "José Ñúñez-O'Neil", rejected: null });
    expect(sanitize("name", "Ana123 <b>")).toEqual({ value: "Ana b", rejected: MSG.name });
  });
  it("cantidad y dinero: sin letras, signos negativos ni decimales", () => {
    expect(sanitize("quantity", "-2")).toEqual({ value: "2", rejected: MSG.quantity });
    expect(sanitize("quantity", "1.5")).toEqual({ value: "15", rejected: MSG.quantity });
    expect(sanitize("money", "$ 1.500.000")).toEqual({ value: "1500000", rejected: null });
    expect(sanitize("money", "1500k")).toEqual({ value: "1500", rejected: MSG.money });
  });
  it("correo: quita espacios (autocompletado) sin tocar lo demás", () => {
    expect(sanitize("email", " Ana@Correo.com ")).toEqual({ value: "Ana@Correo.com", rejected: MSG.emailSpaces });
  });
  it("dirección: admite # - / , . y números; rechaza < > { }", () => {
    expect(sanitize("address", "Cra. 7 # 45-10/2, apto 301").rejected).toBeNull();
    expect(sanitize("address", "Calle <script>")).toEqual({ value: "Calle script", rejected: MSG.address });
  });
  it("nunca agrega ni reordena caracteres válidos", () => {
    for (const [kind, raw] of [["phone", "3x0y0"], ["name", "A1n2a"], ["doc:CC", "1a2b3"], ["money", "9z8"]] as const) {
      const out = sanitize(kind, raw).value;
      let i = 0;
      for (const c of out) { i = raw.indexOf(c, i); expect(i).toBeGreaterThanOrEqual(0); i++; }
    }
  });
});

describe("reglas compartidas (formularios y servidor)", () => {
  it("celular colombiano: 10 dígitos que empiezan por 3; acepta y normaliza +57", () => {
    expect(coMobile.parse("3001234567")).toBe("3001234567");
    expect(coMobile.parse("+57 300 123 4567")).toBe("3001234567");
    for (const bad of ["", "300123456", "30012345678", "2001234567", "300123456a", "+1 3001234567", "300 123 45 6x"]) expect(coMobile.safeParse(bad).success).toBe(false);
  });
  it("celular opcional: vacío es null; si hay algo, debe ser válido", () => {
    expect(optionalMobile.parse("")).toBeNull();
    expect(optionalMobile.parse(undefined)).toBeNull();
    expect(optionalMobile.safeParse("12345").success).toBe(false);
  });
  it("teléfono internacional opcional (Tú lo buscas): E.164 con +", () => {
    expect(optionalIntlPhone.parse("+1 305 555 0100")).toBe("+13055550100");
    expect(optionalIntlPhone.parse("+57 3001234567")).toBe("3001234567");
    expect(optionalIntlPhone.parse("601 234 5678")).toBe("6012345678");
    for (const bad of ["abc", "+0123", "123", "+1234567890123456"]) expect(optionalIntlPhone.safeParse(bad).success).toBe(false);
  });
  it("documento según su tipo (no todos los documentos son numéricos)", () => {
    expect(checkDocument("CC", "1.020.304.050")).toEqual({ ok: true, value: "1020304050" });
    expect(checkDocument("CC", "1234").ok).toBe(false);
    expect(checkDocument("CC", "12345678901").ok).toBe(false);
    expect(checkDocument("CC", "AB12345").ok).toBe(false);
    expect(checkDocument("CE", "12345").ok).toBe(false);
    expect(checkDocument("NIT", "900123456-7").ok).toBe(true);
    expect(checkDocument("NIT", "9001234567").ok).toBe(true);
    expect(checkDocument("NIT", "90012345").ok).toBe(false);
    expect(checkDocument("PASAPORTE", "ab123456")).toEqual({ ok: true, value: "AB123456" });
    expect(checkDocument("PASAPORTE", "AB-123").ok).toBe(false);
    expect(checkDocument("PASAPORTE", "A".repeat(21)).ok).toBe(false);
  });
  it("nombre: rechaza números, símbolos, vacío y demasiado largo", () => {
    expect(personName(3).parse("  María José  ")).toBe("María José");
    for (const bad of ["", "  ", "Jo", "Ana2", "Ana <b>", "@Ana", "-Ana", "a".repeat(121)]) expect(personName(3).safeParse(bad).success).toBe(false);
  });
  it("correo: recorta, pasa a minúsculas y valida el formato", () => {
    expect(emailField.parse("  Ana.Perez@Correo.COM ")).toBe("ana.perez@correo.com");
    for (const bad of ["", "ana", "ana@", "ana@correo", "ana perez@correo.com", `${"a".repeat(250)}@x.co`]) expect(emailField.safeParse(bad).success).toBe(false);
    expect(firstError(emailField.safeParse("ana@"))).toBe(MSG.email);
  });
  it("cantidad: entero mayor que cero y dentro del máximo", () => {
    expect(quantity(20).safeParse(1).success).toBe(true);
    expect(quantity(20).safeParse(20).success).toBe(true);
    for (const bad of [0, -1, 1.5, 21, Number.NaN, "2" as unknown as number]) expect(quantity(20).safeParse(bad).success).toBe(false);
    expect(firstError(quantity(20).safeParse(0))).toBe(MSG.quantity);
  });
  it("dinero en pesos: entero, no negativo, con tope", () => {
    expect(moneyCOP().safeParse(1_500_000).success).toBe(true);
    for (const bad of [-1, 10.5, 300_000_000, Number.POSITIVE_INFINITY]) expect(moneyCOP().safeParse(bad).success).toBe(false);
  });
  it("ciudad y dirección", () => {
    expect(cityName.safeParse("San José del Guaviare").success).toBe(true);
    expect(cityName.safeParse("Medellín 2").success).toBe(false);
    expect(addressText().safeParse("Vereda El Roble, finca La Esperanza").success).toBe(true); // rural, sin número
    expect(addressText().safeParse("Calle 1 <img src=x>").success).toBe(false);
    expect(addressText().safeParse("Cl 1").success).toBe(false);
  });
  it("texto libre: quita caracteres de control y respeta el límite", () => {
    expect(freeText(10).parse("hola\u0000\u0007 mundo")).toBe("hola mundo");
    expect(freeText(10).safeParse("x".repeat(11)).success).toBe(false);
    expect(freeText(100, 5).safeParse("   ").success).toBe(false);
  });
});

describe("checkout: solicitudes manipuladas (sin pasar por el formulario)", () => {
  it("acepta un pedido válido y normaliza datos", () => {
    const r = checkoutSchema.parse(withCustomer({ email: " Maria@Example.com ", phone: "+57 300 123 4567", documentNumber: "1.020.304.050" }));
    expect(r.customer).toMatchObject({ email: "maria@example.com", phone: "3001234567", documentNumber: "1020304050" });
  });
  it("pasaporte con letras es válido; cédula con letras no", () => {
    expect(checkoutSchema.parse(withCustomer({ documentType: "PASAPORTE", documentNumber: "ab123456" })).customer.documentNumber).toBe("AB123456");
    const bad = checkoutSchema.safeParse(withCustomer({ documentType: "CC", documentNumber: "AB123456" }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["customer", "documentNumber"]);
  });
  it.each([
    ["nombre con números", withCustomer({ fullName: "Juan 123" })],
    ["correo sin dominio", withCustomer({ email: "juan@" })],
    ["celular con letras", withCustomer({ phone: "300abc4567" })],
    ["celular fijo", withCustomer({ phone: "6012345678" })],
    ["tipo de documento inventado", withCustomer({ documentType: "DNI" as never })],
    ["documento vacío", withCustomer({ documentNumber: "" })],
    ["ciudad con números", withShipping({ city: "Bogotá 123" })],
    ["dirección con HTML", withShipping({ address: "<script>alert(1)</script>" })],
    ["notas de más de 500", withShipping({ notes: "x".repeat(501) })],
    ["cantidad negativa", { ...order, items: [{ productId: "p1", quantity: -1 }] }],
    ["cantidad decimal", { ...order, items: [{ productId: "p1", quantity: 1.5 }] }],
    ["cantidad en texto", { ...order, items: [{ productId: "p1", quantity: "2" }] }],
    ["cantidad cero", { ...order, items: [{ productId: "p1", quantity: 0 }] }],
    ["cantidad excesiva", { ...order, items: [{ productId: "p1", quantity: 21 }] }],
    ["sin aceptar términos", { ...order, terms: false }],
    ["método de pago inventado", { ...order, paymentMethod: "crypto" }],
  ])("rechaza %s", (_label, payload) => expect(checkoutSchema.safeParse(payload).success).toBe(false));
});

describe("otras API comparten las mismas reglas", () => {
  const address = { label: "Casa", fullName: "Ana Gómez", phone: "3001234567", department: "Antioquia", city: "Medellín", address: "Calle 10 # 20-30", neighborhood: "", notes: "" };
  it("direcciones", () => {
    expect(addressInput.safeParse(address).success).toBe(true);
    expect(addressInput.safeParse({ ...address, phone: "abc" }).success).toBe(false);
    expect(addressInput.safeParse({ ...address, fullName: "Ana 2" }).success).toBe(false);
  });
  it("consultas", () => {
    const base = { name: "Ana", email: "ana@correo.com", topic: "DISPONIBILIDAD", subject: "Talla", message: "¿Tienen talla 40?", consent: true };
    expect(inquiryInput.safeParse(base).success).toBe(true);
    expect(inquiryInput.safeParse({ ...base, name: "1234" }).success).toBe(false);
    expect(inquiryInput.safeParse({ ...base, email: "ana@@correo" }).success).toBe(false);
  });
  it("Tú lo buscas: teléfono con letras rechazado, internacional aceptado", () => {
    const base = { name: "Ana", email: "ana@correo.com", productName: "Tenis", consent: true };
    expect(productRequestInput.safeParse({ ...base, phone: "+1 305 555 0100" }).success).toBe(true);
    expect(productRequestInput.safeParse({ ...base, phone: "llámame" }).success).toBe(false);
    expect(productRequestInput.safeParse({ ...base, budgetCOP: -5 }).success).toBe(false);
    expect(productRequestInput.safeParse({ ...base, budgetCOP: 10.5 }).success).toBe(false);
  });
  it("usuarios del panel", () => {
    expect(adminUserInput.safeParse({ name: "Ana 1", email: "a@b.co", password: "x".repeat(12), role: "ADMIN" }).success).toBe(false);
  });
});
