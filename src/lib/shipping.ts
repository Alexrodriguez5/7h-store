export const FREE_SHIPPING_THRESHOLD = 500_000;
export const FLAT_SHIPPING_COP = 18_000;
export function calculateShipping(subtotalCOP: number): number { return subtotalCOP >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COP; }
export function amountToFreeShipping(subtotalCOP: number): number { return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalCOP); }
