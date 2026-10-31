"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, Product } from "@/types";
import { stockForSize } from "@/lib/sizes";
interface CartState { items:CartItem[]; isOpen:boolean; addItem:(product:Product,size?:string,qty?:number)=>void; removeItem:(key:string)=>void; setQuantity:(key:string,quantity:number)=>void; clear:()=>void; setOpen:(open:boolean)=>void; }
export const useCartStore = create<CartState>()(persist((set)=>({ items:[], isOpen:false,
  addItem:(product,size,qty=1)=>set(s=>{ const available=stockForSize(product,size); if(available<=0) return s; const add=Math.max(1,Math.floor(qty)); const key=`${product.id}:${size??"u"}`; const existing=s.items.find(i=>i.key===key); if(existing) return {isOpen:true,items:s.items.map(i=>i.key===key?{...i,quantity:Math.min(i.quantity+add,available),stock:available,weightGrams:product.weightGrams??null}:i)}; const item:CartItem={key,productId:product.id,name:product.name,image:product.images[0]??"",priceCOP:product.priceCOP,size,quantity:Math.min(add,available),stock:available,weightGrams:product.weightGrams??null}; return {isOpen:true,items:[...s.items,item]}; }),
  removeItem:key=>set(s=>({items:s.items.filter(i=>i.key!==key)})),
  setQuantity:(key,quantity)=>set(s=>({items:quantity<=0?s.items.filter(i=>i.key!==key):s.items.map(i=>i.key===key?{...i,quantity:Math.min(quantity,i.stock)}:i)})),
  clear:()=>set({items:[]}), setOpen:isOpen=>set({isOpen}) }),{name:"7h-cart",storage:createJSONStorage(()=>localStorage),partialize:s=>({items:s.items}),skipHydration:true}));
export const selectCount=(s:CartState)=>s.items.reduce((n,i)=>n+i.quantity,0);
export const selectSubtotal=(s:CartState)=>s.items.reduce((sum,i)=>sum+i.priceCOP*i.quantity,0);
