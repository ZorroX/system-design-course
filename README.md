# SysDesign Quest 🏛️

Aplicación web (mobile + desktop) **gamificada** para aprender System Design a fondo y preparar entrevistas técnicas, con código real en **Java** y **Python** y equivalentes en **AWS, Azure y GCP**.

No es solo preguntas y respuestas: cada concepto se aprende **jugando con un sistema vivo**.

## Qué incluye

| Módulo | Qué es |
|---|---|
| 🗺️ **Mapa de skills** | 16 temas en un árbol de dependencias (fundamentos → tráfico → datos y búsqueda → distribuidos → microservicios → resiliencia → observabilidad). |
| 📖 **Lecciones** | Teoría profunda con widgets interactivos (latencias a escala humana, vertical vs horizontal, resolución DNS paso a paso, lag de replicación, selector SQL vs NoSQL). |
| 🕹️ **11 simuladores con retos** | Load balancer, caché (LRU/LFU/FIFO), anillo de consistent hashing, rate limiter (token/leaky/fixed/sliding), circuit breaker, colas tipo Kafka, partición de red (CAP), elección de shard key, detective de incidentes (observabilidad), laboratorio de analizadores de búsqueda y saga con compensaciones. |
| 🧪 **Design Lab** | Constructor de arquitecturas (drag & drop, también táctil). Un motor de capacidad calcula utilización, errores, latencia p99, disponibilidad y costo **en vivo**. Multiplicador de tráfico y **Chaos Monkey**. 6 retos con estrellas. |
| 🎤 **Entrevistas** | 6 casos clásicos (URL shortener, rate limiter, chat, news feed, video, ride sharing) resueltos con requisitos, estimación, API, modelo de datos, diagrama animado, deep dives, trade-offs y preguntas de seguimiento. **Entrevista simulada** cronometrada de 45 min con rúbrica. |
| 🧮 **Estimación** | Problemas back-of-the-envelope puntuados por orden de magnitud. |
| 🧠 **Repaso** | Flashcards con repetición espaciada (SM-2). |
| ☁️ **Cloud Rosetta** | Cada concepto mapeado a servicios de AWS / Azure / GCP. |
| 📖 **Glosario y artículos** | 160 términos con explicación simple en tooltip (cursor o toque). Las lecciones subrayan automáticamente la primera mención de cada término. 18 artículos a fondo con analogías, código Java/Python y bibliografía externa. |
| 🎯 **Ruta: entrevista Java Backend · Pagos** | Ruta `/path` en 3 etapas (fundamentos y diagnóstico, diseño distribuido, liderazgo C-level) con 8 temas propios (Spring/JVM, concurrencia, diagnóstico en producción, SQL y locks, idempotencia en pagos, Saga/TCC/Outbox, despliegues, liderazgo), 4 simuladores nuevos, caso "Pasarela de pagos", preguntas de práctica con guion, historias STAR y frases de inglés técnico. |
| 🏢 **Mundo real** | Casos de Netflix, Discord, Uber, Stripe, Instagram, Cloudflare, Amazon... |
| 🎮 **Aventura NIMBUS** | RPG top-down con puzles (Phaser 4): restaura 5 pilares resolviendo pruebas de load balancing, caché/Bélády, consistent hashing, particiones/consumer groups y CAP/quórum, y derrota a la Horda del Viernes Negro (tower defense). El **Distrito del Tesoro** (noroeste) añade 6 pruebas para la ruta de entrevista: Bóveda (idempotencia), Forja (thread pools), Torre (incidentes con jstack/jstat/MAT/EXPLAIN), Caravanas (Saga/TCC), Pajarera (canary) y Consejo (STAR). Pixel art y música chiptune generados por código. Ruta `/quest`. |
| 🏅 **Gamificación** | XP, 10 niveles (Intern → Distinguished), rachas, meta diaria, 19 logros, radar de habilidades, heatmap de actividad, reto diario. |

## Estructura

```
app/        Aplicación React + TypeScript (Vite)
  src/data/     Contenido: temas, casos, retos, estimaciones, logros
  src/sims/     Los 8 simuladores
  src/lab/      Catálogo y motor de capacidad del Design Lab
  src/pages/    Pantallas
  src/quest/    Juego NIMBUS: models/ (lógica pura y testeable de cada puzle), scenes/ (Phaser), ui/ (React), art.ts, audio.ts
labs/       Código ejecutable que la app muestra (una sola fuente de verdad)
  java/         Java 17+ (single-file: java Archivo.java)
  python/       Python 3.10+ solo stdlib
_archive/   Material de un intento anterior (curso de Spring Boot), sin uso
```

## Correr la app

```bash
cd app
npm install
npm run dev        # http://localhost:5173 (también accesible desde el móvil en la misma red)
npm run build      # build estático en app/dist (desplegable en cualquier hosting estático)
```

El progreso se guarda en el navegador (localStorage). Desde **Perfil** puedes exportarlo/importarlo como JSON.

## Correr los labs de código

Desde la raíz del repo:

```bash
java labs/java/LruCache.java
python labs/python/lru_cache.py
```

Cada lab tiene una demo con verificaciones (`OK` al final si todo pasa). Hay labs de: load balancing, LRU + cache-aside, consistent hashing, rate limiting, circuit breaker + retry con jitter, mini-Kafka, Snowflake IDs + sharding, quórum N/R/W, idempotency keys, tracing distribuido + métricas RED, índice invertido + BM25 + autocompletado y saga orquestada con compensaciones.

## Extender

- **Nuevo tema**: agrega un objeto `Topic` en `app/src/data/topics/*.ts` y regístralo en `topics/index.ts` (posición en el mapa, prerequisitos, bloques, quiz, flashcards, cloud, casos reales).
- **Nuevo simulador**: crea `app/src/sims/MiSim.tsx` (recibe `done` y `onComplete`) y regístralo en `sims/index.ts`.
- **Nuevo reto del Lab**: agrega un `Challenge` en `app/src/data/challenges.ts`.
- **Nuevo término**: agrégalo en `app/src/data/glossary.ts` (sus `aliases` se auto-enlazan en las lecciones). Para un artículo largo, añade una entrada con la misma clave en `app/src/data/articles.ts`. En cualquier texto puedes forzar un tooltip con `[[id]]` o `[[id|texto]]`.
- **Nuevo caso de entrevista**: agrega un `CaseStudy` en `app/src/data/cases.ts`.

## Fuentes

Basado en: donnemartin/system-design-primer, karanpratapsingh/system-design, ashishps1/awesome-system-design-resources, binhnguyennus/awesome-scalability, madd86/awesome-system-design, design-gurus/grokking-system-design y *Designing Data-Intensive Applications*.
