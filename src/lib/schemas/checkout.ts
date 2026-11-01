import { z } from "zod";
export const checkoutSchema = z.object({
  customer: z.object({ fullName:z.string().trim().min(3,"Escribe tu nombre completo").max(120,"Nombre demasiado largo"), email:z.string().trim().max(254,"Correo demasiado largo").email("Correo no válido"), phone:z.string().regex(/^3\d{9}$/,"Celular colombiano de 10 dígitos"), documentType:z.enum(["CC","CE","NIT","PASAPORTE"]), documentNumber:z.string().trim().min(5,"Documento no válido").max(20,"Documento no válido") }),
  shipping: z.object({ department:z.string().min(3,"Selecciona el departamento").max(60), city:z.string().min(2,"Selecciona la ciudad").max(80), address:z.string().trim().min(6,"Escribe una dirección válida").max(200,"Dirección demasiado larga"), neighborhood:z.string().max(100).optional(), notes:z.string().max(500,"Máximo 500 caracteres").optional() }),
  paymentMethod:z.enum(["card","pse","bank_transfer","cash_deposit"]),
  terms:z.literal(true,"Debes aceptar los términos y la política de datos"),
  items:z.array(z.object({ productId:z.string().min(1).max(64), size:z.string().max(20).optional(), quantity:z.number().int().positive().max(20) })).min(1,"El carrito está vacío").max(50,"Demasiados productos en un pedido")
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
