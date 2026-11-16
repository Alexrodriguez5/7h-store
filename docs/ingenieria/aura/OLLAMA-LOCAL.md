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

## Resultados medidos (16 de noviembre de 2026)

Equipo: i7-13620H, 16 GB de RAM, RTX 4060 Laptop de 8 GB. Ollama 0.40.16. Modelo `qwen3.5:4b` (Q4_K_M, 3,3 GB, licencia Apache 2.0).

| Medida | Resultado |
|---|---|
| Memoria de GPU con el modelo cargado | 3,4 GB, 100 % en GPU, contexto de 8.192 |
| Carga inicial del modelo | 8 a 9 s |
| Mediana por respuesta (10 preguntas, 2 corridas) | 1,7 a 1,9 s |
| Primera respuesta con herramientas | 13 a 20 s (supera el tiempo propio de 12 s: en la tienda pasaría a Gemini) |
| Respuestas sin error | 9 de 10 y 10 de 10 |
| Respaldo con Ollama apagado | Gemini respondió 2 de 2 con datos reales del catálogo, en unos 6 s |

Calidad observada:

- Bien: usa `buscar_productos` con argumentos válidos, muestra precios reales, avisa que el catálogo es demostrativo, rechaza descuentos inventados y la inyección de instrucciones.
- Riesgos: en una corrida inventó un plazo de envío («2 a 4 días hábiles»; el real es de 5 a 10) sin consultar `consultar_politicas`; sugiere marcas que no están en el catálogo sin buscar; responde preguntas ajenas a la tienda. En la tienda, las preguntas de envíos y políticas las responde primero la biblioteca aprobada, lo que reduce este riesgo, pero no lo elimina.

Conclusión: sirve para pruebas locales y como base. No está lista para atender clientes sin una prueba más amplia (el conjunto de `tests/fixtures/aura-eval.txt`) y sin reforzar el uso obligatorio de herramientas para políticas y productos.

Nota de red: en este equipo IPv6 no funciona y `ollama pull` falla. El modelo se descargó por IPv4 desde el registro oficial, verificando el SHA-256 de cada capa.
