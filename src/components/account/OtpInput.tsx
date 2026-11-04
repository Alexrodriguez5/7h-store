"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

/**
 * Código de 6 dígitos en casillas individuales (estilo vidrio).
 * - Avanza solo al escribir, retrocede con Borrar y acepta pegar el código completo.
 * - Cada dígito "salta" al escribirse; con `error` las casillas tiemblan; con `success` se iluminan.
 * - Accesible: un grupo con nombre y cada casilla con su etiqueta; `one-time-code` en la primera
 *   para que el celular sugiera el código del correo o SMS.
 */
export function OtpInput({ value, onChange, error = false, success = false, disabled = false, autoFocus = true }: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  success?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [popped, setPopped] = useState<number | null>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\D/g, "").slice(0, 6);
    onChange(next);
  };
  const onInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    if (d.length > 1) { onChange((value.slice(0, i) + d).slice(0, 6)); refs.current[Math.min(5, i + d.length)]?.focus(); return; }
    setAt(i, d);
    setPopped(i);
    refs.current[Math.min(5, i + 1)]?.focus();
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!d) return;
    e.preventDefault();
    onChange(d);
    refs.current[Math.min(5, d.length)]?.focus();
  };

  return (
    <div role="group" aria-label="Código de 6 dígitos" className={`flex justify-between gap-2 sm:gap-3 ${error ? "otp-shake" : ""}`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Dígito ${i + 1}`}
          maxLength={6}
          value={d}
          disabled={disabled}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          onAnimationEnd={() => setPopped(null)}
          className={`h-14 w-full min-w-0 rounded-2xl border text-center font-display text-3xl text-ivory caret-gold-light outline-none transition-all duration-200 sm:h-16
            ${popped === i ? "otp-pop" : ""}
            ${success ? "border-gold-light bg-gold/20 shadow-[0_0_24px_-4px_rgb(216_184_102_/_.8)]" : error ? "border-red-400/70 bg-red-500/10" : d ? "border-gold/60 bg-white/[.08]" : "border-white/12 bg-white/[.04]"}
            focus:border-gold-light focus:bg-white/[.1] focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.18)] disabled:opacity-70`}
        />
      ))}
    </div>
  );
}
