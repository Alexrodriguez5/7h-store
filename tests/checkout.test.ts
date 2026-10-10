import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/schemas/checkout";
const data={customer:{fullName:"Juan Pérez",email:"juan@example.com",phone:"3001234567",documentType:"CC" as const,documentNumber:"123456789"},shipping:{department:"Meta",city:"Villavicencio",address:"Carrera 1 # 2-3"},paymentMethod:"card" as const,terms:true as const,items:[{productId:"p1",quantity:1}]};
describe("checkout schema",()=>{it("acepta datos válidos",()=>expect(checkoutSchema.safeParse(data).success).toBe(true));it("rechaza celular inválido",()=>expect(checkoutSchema.safeParse({...data,customer:{...data.customer,phone:"123"}}).success).toBe(false));it("requiere términos",()=>expect(checkoutSchema.safeParse({...data,terms:false}).success).toBe(false));});
