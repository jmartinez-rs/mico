# WorkingDocs — Comparativa: LlamaIndex, OpenWiki y WorkingDocs

# WorkingDocs vs OpenWiki vs LlamaIndex

## ¿LlamaIndex funciona para esto?

Sí, LlamaIndex te puede servir de base, pero como **framework** para construir el sistema, no como producto final. En tu idea, LlamaIndex sería la infraestructura para ingestión, retrieval, agentes y flujos documentales; OpenWiki es más un caso de uso concreto de wiki viva para código; y WorkingDocs es una capa de producto más amplia, enfocada en capturar trabajo real y convertirlo en documentación viva.

## Qué aporta LlamaIndex

LlamaIndex está pensado para construir knowledge assistants y agentes conectados a datos enterprise, con memoria, herramientas y flujos de múltiples pasos. Además, ya trae patrones muy útiles para tu caso: agentes de largo horizonte, workflows de documentos y recuperación multi-step tipo find → retrieve → read/grep. Eso encaja muy bien si tu agente necesita leer contexto del workspace, buscar cambios, resumir y producir documentación con trazabilidad.

## Dónde encaja en tu producto

- Ingestar archivos, commits, notas y contexto de sesión
- Construir retrieval sobre código y docs
- Orquestar tareas del agente
- Exponer herramientas tipo search, read, grep y summarize
- Mantener un loop persistente para sesiones largas

En otras palabras: **LlamaIndex puede ser el "motor" del agente**, mientras que WorkingDocs sería la experiencia de producto y la capa de negocio.

## Diferencias con OpenWiki

OpenWiki está más enfocado en una wiki mantenida automáticamente para codebases y agentes de código, con salida estructurada de documentación sobre arquitectura, integraciones y workflows del repo. Tu idea es más amplia porque quiere capturar el trabajo que ocurre alrededor del código: lo hecho en Cursor, la sesión, la decisión, el resumen y luego la publicación o exportación.

| OpenWiki | WorkingDocs |
| --- | --- |
| Documentación viva de la codebase | Documentación del trabajo y del proceso |
| CLI-focused (LangChain) | Web app + agente local |
| Wiki del repo | Captura de sesiones + decisiones + contexto |

## Resumen de diferencias

| Herramienta | Rol |
| --- | --- |
| **LlamaIndex** | Framework para construir el agente, retrieval y flujos documentales |
| **OpenWiki** | Caso de uso concreto: wiki viva para codebases |
| **WorkingDocs** | Producto final: captura de trabajo real → documentación viva |

## Recomendación

Tomar LlamaIndex como base técnica para acelerar el agente, el retrieval y los flujos documentales. Pero no usarlo como referencia de producto, porque la diferenciación está en la captura del workflow y en la experiencia de documentación viva, no solo en el motor de IA.