const cop = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 });
export const formatCOP = (value:number) => cop.format(value);
