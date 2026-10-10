import type {OrderStatus} from "@/types";
const steps:[OrderStatus,string][]=[["pending_payment","Pago pendiente"],["paid","Pago confirmado"],["processing","En preparación"],["shipped","Enviado"],["delivered","Entregado"]];
const rank=(s:OrderStatus)=>s==="cancelled"||s==="expired"?-1:steps.findIndex(x=>x[0]===s);
export function OrderTimeline({status}:{status:OrderStatus}){const current=rank(status);return <ol className="grid gap-4 sm:grid-cols-5">{steps.map(([key,label],i)=><li key={key} className="border-t pt-3" style={{borderColor:i<=current?"#C9A44C":undefined}}><span className="text-[10px] uppercase tracking-widest text-ink-soft">0{i+1}</span><p className={`mt-1 text-xs ${i<=current?"font-semibold":"text-ink-soft/60"}`}>{label}</p></li>)}</ol>}
