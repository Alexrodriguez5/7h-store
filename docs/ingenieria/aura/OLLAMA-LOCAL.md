# AURA con Ollama en local

Guía para probar AURA con un modelo local. **Solo desarrollo.** Producción sigue con `AURA_PROVIDER=gemini` hasta que el dueño autorice otra cosa.

## Cómo funciona

| Pieza | Archivo |
|---|---|
| Adaptador de Ollama (`/api/chat`, herramientas, tiempo máximo propio, errores sin claves) | `src/lib/aura/ollama.ts` |
| Elección de principal y respaldo según `AURA_PROVIDER` | `src/lib/aura/providers.ts` |
| Variables y reglas de seguridad (`OLLAMA_*`) | `src/lib/aura/config.ts` |
| Prueba de rendimiento y de respaldo, sin escribir en la base | `scripts/aura/probar-ollama.ts` |

Orden de respuesta con `AURA_PROVIDER=ollama`: biblioteca aprobada → Ollama → Gemini (solo si Ollama está caído, lento o saturado) → mensaje fijo.

Reglas:

- Fuera de `localhost`, `OLLAMA_BASE_URL` debe ser HTTPS.
- Ollama Cloud (`ollama.com`) es de pago. Queda bloqueado salvo `OLLAMA_ALLOW_PAID=1`, que requiere autorización del dueño.
- El puerto 11434 nunca se expone a Internet.
- El adaptador nunca registra la clave ni el contenido enviado.

## Instalar (una vez)

```powershell
winget install --id Ollama.Ollama -e
ollama pull qwen3.5:4b
```

## Iniciar y detener

```powershell
ollama serve            # o abre la aplicación "Ollama"; escucha solo en 127.0.0.1:11434
ollama ps               # modelos cargados y memoria usada
ollama stop qwen3.5:4b  # libera la memoria de la GPU
```

Para cerrar Ollama del todo, sal de la aplicación desde el ícono de la bandeja del sistema.

## Probar AURA en local

En `.env.local` (nunca se sube a Git):

```
AURA_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
# GEMINI_API_KEY=...  (solo si quieres el respaldo; la pone el dueño)
```

Después:

```powershell
npm.cmd run dev                                       # el chat de AURA usa Ollama
npx tsx scripts/aura/probar-ollama.ts                  # 10 preguntas medidas, solo lectura
npx tsx scripts/aura/probar-ollama.ts --respaldo       # simula Ollama caído: debe responder Gemini
```

Atención: el chat de la tienda (`npm.cmd run dev`) guarda conversaciones en la base de datos configurada. Mientras `.env.local` apunte a producción, usa el script, que no escribe nada.

Para volver a Gemini, borra `AURA_PROVIDER` o ponlo en `gemini`.
