# Cerebro de AURA · biblioteca de conocimiento (nivel 1)

AURA responde primero con **respuestas aprobadas por el equipo**, sin IA generativa y sin gastar cuota. Solo si no
encuentra una coincidencia clara pasa al nivel 2 (hoy Gemini gratuito; después, el modelo local), llevando como pista
**únicamente** las respuestas aprobadas relacionadas (RAG). Si todo falla, ofrece el asistente guiado.

```
Cliente → filtro de privacidad → NIVEL 1 biblioteca (aprobada) ──sí──→ «Respuesta verificada de 7H STORE»
                                              └─no / dudosa─→ NIVEL 2 modelo + herramientas (+ pistas aprobadas)
                                                                   └─falla─→ NIVEL 3 respaldo / asistente guiado
```

## Puesta en marcha

1. Ejecuta `docs/MIGRACION-AURA-CEREBRO.sql` en Supabase (SQL Editor). Solo crea 4 tablas nuevas.
2. Entra a **Admin → Cerebro de AURA** y pulsa **Cargar conocimiento verificado de la tienda**: crea 18 respuestas
   tomadas de las páginas publicadas (Nosotros, Preguntas frecuentes, Envíos, Devoluciones, Cómo comprar, Búsqueda
   personalizada, Cuenta, Contacto). Todas quedan **pendientes**.
3. Revisa cada una y pulsa **Aprobar** (solo las preguntas reales) o **Aprobar con sintéticas** (también las variantes
   escritas a partir de la respuesta). Desde ese momento AURA las usa en el chat (la caché se renueva en ≤ 60 s).
4. Usa la pestaña **Probar** para ver qué respondería AURA, con puntajes, antes y después de aprobar.

## Cómo busca

- Normaliza (minúsculas, sin tildes), quita palabras vacías y reduce cada palabra a su raíz ("registrarme" y
  "registro" → "regist").
- Corrige errores comunes contra el vocabulario de la biblioteca ("cuanto bale el enbio" → "cuanto vale envio").
- Reconoce **conceptos** con sinónimos de comercio electrónico (envío = domicilio, transporte, flete, traer…;
  costo = vale, cobran, precio…). La lista está en `src/lib/aura/library/text.ts`.
- Puntaje = palabras en común (ponderadas) + conceptos en común + parecido de letras, contra TODAS las formas
  aprobadas de cada respuesta.
- **Responde solo si** el puntaje ≥ 0,5, le saca ≥ 0,08 a la segunda opción y la respuesta "conoce" ≥ 70 % de lo que
  dijo el cliente. Una marca o un producto desconocido baja esa cobertura: esas preguntas van al catálogo (nivel 2).
- Con más de ~400 respuestas, PostgreSQL (búsqueda de texto en español, índice GIN) preselecciona candidatos.

## Formatos de importación

| Formato | Cómo se interpreta |
| --- | --- |
| CSV | Columnas `pregunta, respuesta, categoria, variantes, fuente, sinteticas`. Variantes separadas por `|`. `sinteticas` = si/no. |
| JSON | Lista de objetos con esos mismos campos (`variantes` como lista). |
| TXT / Markdown | Documento: se divide por títulos y párrafos (~120 palabras). Son **fragmentos de documento**: sirven de contexto al modelo, nunca se responden tal cual. |
| PDF / DOCX | Aún no: se procesarán en el servicio Python (fase 4). |

Límites: 3 MB y 5.000 registros por archivo. Todo entra **pendiente**. Al importar se marcan **posibles duplicados**
(misma respuesta o pregunta casi igual) y **posibles contradicciones** (pregunta casi igual con otra respuesta).
Una respuesta con fecha de revisión vencida deja de usarse hasta que se revise.

Marcadores que se llenan con los valores vigentes: `{{envio_gratis}}`, `{{plazo_envio}}`, `{{aviso_pagos}}`.

## Aprendizaje y calidad

- Cada pregunta de tienda que la biblioteca no responde queda como **sin respuesta** o **poco confiable** (agrupadas;
  el texto ya pasó por el filtro de privacidad).
- El botón **¿Te sirvió? → No** en el chat deja la pregunta como **marcada como incorrecta**.
- AURA **no aprende sola**: el equipo crea o corrige la respuesta, la aprueba y marca la pregunta como resuelta.
- Cada cambio queda en `KnowledgeRevision` (versión, quién y cuándo) y en la auditoría del panel. Editar una respuesta
  aprobada la devuelve a **pendiente**.

## Evaluación

`tests/fixtures/aura-eval.txt`: 206 preguntas escritas de forma distinta a las de la biblioteca (con errores
ortográficos, coloquiales, incompletas) y 50 que **no** debe responder (productos, conversación, temas ajenos,
intentos de manipulación). Se ejecuta con `npx vitest run tests/aura-library.test.ts`.

Resultado medido el 8 de noviembre de 2026 con la biblioteca inicial: **161/206 correctas (78 %)**, **0 respuestas
equivocadas** y **0 respondidas de más**. Las 45 restantes no son errores: pasan al nivel 2. Bajar los umbrales
subía la cobertura a 85 %, pero introducía respuestas equivocadas, por eso no se bajaron.
