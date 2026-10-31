import { TRACKING_STEPS, completedStep } from "@/lib/order-tracking";

/**
 * Línea de tiempo del pedido con los estados REALES del sistema: solo se marcan como completadas
 * las etapas alcanzadas. Horizontal desde tablet; vertical en celulares.
 */
export function OrderTimeline({ status }: { status: string }) {
  const done = completedStep(status);
  const current = Math.min(done + 1, TRACKING_STEPS.length - 1);
  const finished = status === "delivered";
  return (
    <ol className="relative grid gap-0 md:grid-cols-5 md:gap-2" aria-label="Estado del pedido">
      {TRACKING_STEPS.map((step, i) => {
        const complete = i <= done;
        const active = !finished && done >= 0 && i === current;
        return (
          <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0 md:flex-col md:items-center md:gap-3 md:pb-0 md:text-center">
            {/* Conector: vertical en móvil, horizontal en escritorio */}
            {i < TRACKING_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 md:left-[calc(50%+22px)] md:top-[17px] md:h-0.5 md:w-[calc(100%-44px+0.5rem)] ${i < done ? "bg-gold" : "bg-ink/10"}`}
              />
            )}
            <span
              className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-colors ${
                complete ? "border-gold bg-gold text-ink" : active ? "border-gold bg-ivory text-ink" : "border-ink/15 bg-ivory text-ink/40"
              }`}
            >
              {complete ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              ) : (
                i + 1
              )}
              {active && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border-2 border-gold/60" />}
            </span>
            <div className="pt-1 md:pt-0">
              <p className={`text-sm ${complete || active ? "font-semibold text-ink" : "text-ink/45"}`}>
                {step.label}
                <span className="sr-only">{complete ? " (completado)" : active ? " (en curso)" : " (pendiente)"}</span>
              </p>
              <p className={`mt-0.5 text-xs ${complete || active ? "text-ink-soft" : "text-ink/35"}`}>{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
