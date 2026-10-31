import { z } from "zod";
import { COLOMBIA } from "@/data/colombia";

export const addressInput = z.object({
  label: z.string().trim().min(2, "Ponle un nombre (Casa, Oficina…)").max(40),
  fullName: z.string().trim().min(3, "Nombre de quien recibe").max(120),
  phone: z.string().trim().regex(/^3\d{9}$/, "Celular colombiano de 10 dígitos"),
  department: z.string().refine((d) => d in COLOMBIA, "Departamento no válido"),
  city: z.string().trim().min(2, "Escribe la ciudad o municipio").max(80),
  address: z.string().trim().min(6, "Escribe una dirección válida").max(200),
  neighborhood: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressInput>;
export const MAX_ADDRESSES = 10;
