export type CategorySlug = "tecnologia" | "ropa" | "calzado" | "accesorios";
export type Gender = "hombre" | "mujer" | "unisex";
export interface Category { slug: CategorySlug; label: string; }
export interface ProductVariantInfo { id?: string; size: string; stock: number; }
export interface Product { id: string; slug: string; name: string; brand: string; description: string; priceCOP: number; compareAtPriceCOP?: number; category: CategorySlug; gender: Gender; isAccessory: boolean; images: string[]; sizes?: string[]; variants?: ProductVariantInfo[]; stock: number; tags: string[]; featured?: boolean; }
export interface CartItem { key: string; productId: string; name: string; image: string; priceCOP: number; size?: string; quantity: number; stock: number; }
export type SortOption = "relevancia" | "precio-asc" | "precio-desc" | "novedades";
export interface FilterState { search: string; category: CategorySlug | "todo"; gender: Gender | "todos"; onlyAccessories: boolean; maxPriceCOP: number | null; sort: SortOption; }
export const DEFAULT_FILTERS: FilterState = { search: "", category: "todo", gender: "todos", onlyAccessories: false, maxPriceCOP: null, sort: "relevancia" };
export type PaymentMethod = "card" | "pse" | "bank_transfer" | "cash_deposit";
export type OrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "expired";
