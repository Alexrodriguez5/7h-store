import { z } from "zod";
import { addressText, cityName, coMobile, freeText, personName } from "@/lib/validation/fields";
import { COLOMBIA } from "@/data/colombia";

export const addressInput = z.object({
  label: z.string().trim().min(2, "Ponle un nombre (Casa, Oficina…)").max(40),
  fullName: personName(3, 120, "Nombre de quien recibe"),
  phone: coMobile,
  department: z.string().refine((d) => d in COLOMBIA, "Departamento no válido"),
  city: cityName,
  address: addressText(6, 200),
  neighborhood: freeText(100).optional().or(z.literal("")),
  notes: freeText(300).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressInput>;
export const MAX_ADDRESSES = 10;
