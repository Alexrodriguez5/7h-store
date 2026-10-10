import type {PaymentMethod} from "@/types";
export interface GatewayOrder { id:string; publicCode:string; totalCOP:number; customerEmail:string; paymentMethod:PaymentMethod; }
export interface PaymentGateway { createCheckout(order:GatewayOrder):Promise<{redirectUrl:string;providerRef:string}>; verifyWebhook(req:Request):Promise<{providerRef:string;status:"APPROVED"|"DECLINED"|"PENDING";publicCode:string;rawPayload:unknown}>; }
