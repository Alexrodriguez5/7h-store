import { z } from "zod";
import { DOCUMENT_TYPES, addressText, cityName, coMobile, emailField, freeText, personName, quantity, refineDocument } from "@/lib/validation/fields";

/**
 * Checkout: el formulario y POST /api/orders usan este mismo esquema, así que el servidor rechaza cualquier dato
 * que el formulario tampoco aceptaría (aunque la solicitud se arme a mano).
 */
export const checkoutSchema = z.object({
  customer: z
    .object({
      fullName: personName(3, 120, "Escribe tu nombre completo"),
      email: emailField,
      phone: coMobile,
      documentType: z.enum(DOCUMENT_TYPES, "Elige el tipo de documento"),
      documentNumber: z.string().trim().min(1, "Escribe tu número de documento").max(20, "Documento demasiado largo"),
    })
    // El número se valida según el tipo: la cédula solo admite dígitos y el pasaporte admite letras y números.
    .superRefine(refineDocument)
    .transform((c) => ({ ...c, documentNumber: c.documentType === "PASAPORTE" ? c.documentNumber.replace(/[\s.]/g, "").toUpperCase() : c.documentNumber.replace(/[\s.]/g, "") })),
  shipping: z.object({
    department: z.string().min(3, "Selecciona el departamento").max(60),
    city: cityName,
    address: addressText(6, 200),
    neighborhood: freeText(100).optional(),
    notes: freeText(500).optional(),
  }),
  paymentMethod: z.enum(["card", "pse", "bank_transfer", "cash_deposit"]),
  terms: z.literal(true, "Debes aceptar los términos y la política de datos"),
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), size: z.string().max(20).optional(), quantity: quantity(20) }))
    .min(1, "El carrito está vacío")
    .max(50, "Demasiados productos en un pedido"),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
