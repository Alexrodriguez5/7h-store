import { describe, expect, it } from "vitest";
import { applyFilters } from "@/lib/filters";
import type { Product } from "@/types";
const products:Product[]=[{id:"1",slug:"a",name:"Tenis Blanco",brand:"Marca",description:"",priceCOP:300000,category:"calzado",gender:"mujer",isAccessory:false,images:[],stock:2,tags:["tenis"],featured:true},{id:"2",slug:"b",name:"Reloj",brand:"Marca",description:"",priceCOP:600000,category:"accesorios",gender:"unisex",isAccessory:true,images:[],stock:2,tags:["reloj"],featured:false}];
describe("applyFilters",()=>{it("filtra categoría",()=>expect(applyFilters(products,{search:"",category:"calzado",gender:"todos",onlyAccessories:false,maxPriceCOP:null,sort:"relevancia"})).toHaveLength(1));it("ordena precio",()=>expect(applyFilters(products,{search:"",category:"todo",gender:"todos",onlyAccessories:false,maxPriceCOP:null,sort:"precio-desc"})[0].priceCOP).toBe(600000));});
