# WorkingDocs — Referencia: claude-blog (AgriciDaniel)

# WorkingDocs — Referencia: claude-blog (AgriciDaniel)

## Repositorio

https://github.com/AgriciDaniel/claude-blog

## Para qué sirve

Como **referencia de arquitectura y disciplina de ejecución**, no como base de producto. El repo está orientado a blogs con pipeline estructurada (30 sub-skills, 5 agentes, contrato de entrega con gates y tests).

## Qué sí tomar de este repo

- Un flujo por etapas, no una sola prompt
- Gates de calidad antes de entregar resultados
- Auditoría y scoring automático
- Versionado y trazabilidad
- Separación entre orquestador, agentes y scripts

Eso es transferible a WorkingDocs: repo scan → inference → summary → confidence check → publish.

## Qué NO copiar

La parte de blog/SEO y estructura de contenido — WorkingDocs no genera artículos, sino documentación técnica basada en trabajo real.

## La analogía útil

El patrón del repo:

1. Detecta si tiene el contexto necesario
2. Procesa el input en pasos
3. Valida salida
4. Bloquea entregas malas
5. Guarda trazabilidad

## Diferencia con WorkingDocs

WorkingDocs además necesita:

- Lectura de commits y diffs
- Resúmenes por repo, sprint o semana
- Detección de trabajo no documentado
- Guardado en web app de conocimiento
- Integración con GitHub y Cursor

## Recomendación

Usar como benchmark de cómo estructurar un agente serio. No como referente de dominio, sino como inspiración para el motor de workflow, gates, testing y release discipline.