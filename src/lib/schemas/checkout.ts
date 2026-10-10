import { z } from "zod";
export const checkoutSchema = z.object({
  customer: z.object({ fullName:z.string().trim().min(3,"Escribe tu nombre completo"), email:z.string().email("Correo no válido"), phone:z.string().regex(/^3\d{9}$/,"Celular colombiano de 10 dígitos"), documentType:z.enum(["CC","CE","NIT","PASAPORTE"]), documentNumber:z.string().trim().min(5,"Documento no válido") }),
  shipping: z.object({ department:z.string().min(3,"Selecciona el departamento"), city:z.string().min(2,"Selecciona la ciudad"), address:z.string().min(6,"Escribe una dirección válida"), neighborhood:z.string().optional(), notes:z.string().optional() }),
  paymentMethod:z.enum(["card","pse","bank_transfer","cash_deposit"]),
  terms:z.literal(true,"Debes aceptar los términos y la política de datos"),
  items:z.array(z.object({ productId:z.string().min(1), size:z.string().optional(), quantity:z.number().int().positive().max(20) })).min(1,"El carrito está vacío")
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
