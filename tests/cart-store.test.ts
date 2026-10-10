import { beforeEach, describe, expect, it } from "vitest";
import { selectSubtotal, useCartStore } from "@/store/cart-store";
import type { Product } from "@/types";
const product:Product={id:"p1",slug:"p1",name:"Producto",brand:"Marca",description:"",priceCOP:100000,category:"tecnologia",gender:"unisex",isAccessory:false,images:["x"],stock:2,tags:[]};
describe("cart store",()=>{beforeEach(()=>useCartStore.setState({items:[],isOpen:false}));it("limita al stock",()=>{useCartStore.getState().addItem(product);useCartStore.getState().addItem(product);useCartStore.getState().addItem(product);expect(useCartStore.getState().items[0].quantity).toBe(2);expect(selectSubtotal(useCartStore.getState())).toBe(200000);});it("elimina líneas",()=>{useCartStore.getState().addItem(product);useCartStore.getState().removeItem("p1:u");expect(useCartStore.getState().items).toHaveLength(0);});});
