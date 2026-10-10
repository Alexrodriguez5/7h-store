import { describe, expect, it } from "vitest";
import { calculateShipping } from "@/lib/shipping";
describe("shipping",()=>{it("es gratis desde 500000",()=>expect(calculateShipping(500000)).toBe(0));it("cobra tarifa base por debajo",()=>expect(calculateShipping(499999)).toBe(18000));});
