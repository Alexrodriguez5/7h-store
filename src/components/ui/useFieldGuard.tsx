"use client";
import { useCallback, useRef, useState, type ChangeEvent, type FocusEvent } from "react";
import type { ZodType } from "zod";
import { inputAttrs, sanitize, type FieldKind } from "@/lib/validation/fields";

type FieldEl = HTMLInputElement | HTMLTextAreaElement;

const omit = (o: Record<string, string>, k: string) => { const next = { ...o }; delete next[k]; return next; };

/**
 * Filtra un campo mientras se escribe o se pega: quita SOLO lo que ese campo no admite, conserva la posición
 * del cursor y devuelve el aviso a mostrar (o null). Modifica `el.value` antes de que React o react-hook-form
 * lo lean, así el estado nunca recibe caracteres no permitidos.
 */
export function guardElement(kind: FieldKind, el: FieldEl): string | null {
  const raw = el.value;
  const r = sanitize(kind, raw);
  if (r.value !== raw) {
    const caret = el.selectionStart ?? raw.length;
    // El cursor queda tras los caracteres válidos que había antes de él.
    const next = Math.min(sanitize(kind, raw.slice(0, caret)).value.length, r.value.length);
    el.value = r.value;
    try { el.setSelectionRange(next, next); } catch { /* type=email no admite selección */ }
  }
  return r.rejected;
}

interface FieldOpts {
  /** Esquema Zod compartido con el servidor: valida al salir del campo y al enviar. */
  schema?: ZodType;
  /** Obligatorio: un campo vacío se marca al salir de él (por defecto solo se valida si tiene algo escrito). */
  required?: boolean;
  requiredMessage?: string;
}

/**
 * Validación de campos para formularios controlados (value + onChange):
 * - mientras se escribe: filtra caracteres y muestra un aviso breve («Este campo solo permite números»);
 * - al salir del campo: valida con el esquema compartido y deja el error debajo del campo;
 * - al enviar (`check`): valida todo, marca los campos inválidos y lleva el foco al primero.
 * No muestra errores en campos que la persona aún no tocó.
 */
export function useFieldGuard() {
  const [hints, setHints] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const opts = useRef<Record<string, FieldOpts & { kind?: FieldKind }>>({});
  const els = useRef<Record<string, FieldEl | null>>({});

  const flash = useCallback((name: string, message: string) => {
    setHints((h) => ({ ...h, [name]: message }));
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(() => setHints((h) => omit(h, name)), 3500);
  }, []);

  const validate = useCallback((name: string, value: string): string | null => {
    const o = opts.current[name] ?? {};
    if (!value.trim()) return o.required ? (o.requiredMessage ?? "Este campo es obligatorio.") : null;
    if (!o.schema) return null;
    const r = o.schema.safeParse(value);
    return r.success ? null : (r.error.issues[0]?.message ?? "Dato no válido.");
  }, []);

  const setError = useCallback((name: string, message: string | null) => {
    setErrors((e) => {
      if (!message) return name in e ? omit(e, name) : e;
      return e[name] === message ? e : { ...e, [name]: message };
    });
  }, []);

  /** Props para un <input>/<textarea>: filtro, teclado adecuado, validación al salir y estado aria-invalid. */
  const field = useCallback(
    <E extends FieldEl>(name: string, kind: FieldKind | null, onChange: (e: ChangeEvent<E>) => void, o: FieldOpts = {}) => {
      opts.current[name] = { ...o, kind: kind ?? undefined };
      const describedBy = `${name}-msg`;
      return {
        ...(kind ? inputAttrs(kind) : {}),
        name,
        ref: (el: E | null) => { els.current[name] = el; },
        "aria-invalid": errors[name] ? true : undefined,
        "aria-describedby": hints[name] || errors[name] ? describedBy : undefined,
        onChange: (e: ChangeEvent<E>) => {
          if (kind) {
            const rejected = guardElement(kind, e.currentTarget);
            if (rejected) flash(name, rejected);
          }
          // Si ya había un error, se re-valida al escribir para quitarlo apenas el dato sea válido.
          if (errors[name]) setError(name, validate(name, e.currentTarget.value));
          onChange(e);
        },
        onBlur: (e: FocusEvent<E>) => setError(name, validate(name, e.currentTarget.value)),
      };
    },
    [errors, hints, flash, setError, validate],
  );

  /** Valida todos los campos indicados ({ nombre: valor }); marca errores y enfoca el primero. true = todo bien. */
  const check = useCallback(
    (values: Record<string, string | null | undefined>) => {
      const found: Record<string, string> = {};
      for (const [name, value] of Object.entries(values)) {
        const m = validate(name, value ?? "");
        if (m) found[name] = m;
      }
      setErrors((e) => {
        const next = { ...e };
        for (const name of Object.keys(values)) delete next[name];
        return { ...next, ...found };
      });
      const first = Object.keys(values).find((n) => found[n]);
      if (first) els.current[first]?.focus();
      return !first;
    },
    [validate],
  );

  /** Mensaje debajo del campo: el error (si lo hay) o el aviso breve del filtro. */
  const Msg = useCallback(
    ({ name, className = "" }: { name: string; className?: string }) => {
      const error = errors[name];
      const hint = hints[name];
      if (!error && !hint) return null;
      return (
        <span id={`${name}-msg`} role={error ? "alert" : "status"} aria-live="polite" className={`mt-1 block text-xs font-normal ${error ? "text-error" : "text-ink-soft"} ${className}`}>
          {error ?? hint}
        </span>
      );
    },
    [errors, hints],
  );

  return { field, check, Msg, errors, hints, flash, setError };
}

/**
 * Envuelve un onChange para campos numéricos simples (panel admin): deja solo dígitos antes de guardar el valor.
 * `money` además quita sin aviso puntos de miles, comas y el signo $ ("1.500.000" → "1500000").
 */
export const onlyDigits = <E extends FieldEl>(fn: (e: ChangeEvent<E>) => void, kind: "digits" | "money" = "digits") => (e: ChangeEvent<E>) => {
  guardElement(kind, e.currentTarget);
  fn(e);
};
