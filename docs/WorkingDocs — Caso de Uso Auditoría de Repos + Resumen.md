# WorkingDocs — Caso de Uso: Auditoría de Repos + Resumen

# WorkingDocs — Caso de Uso: Auditoría de Repos + Resumen de Trabajo

## Origen

El manager de Jose usa Cursor para auditar repositorios de GitHub y generar resúmenes de lo trabajado, porque algunos empleados no documentan. Eso es exactamente el caso de uso que WorkingDocs debe capturar.

## Qué está haciendo hoy Cursor

Cursor ya se usa para auditar repos, cargar reglas, revisar arquitectura, generar docs y producir resúmenes persistentes del trabajo hecho. También hay ejemplos de uso como revisar commits semanales, detectar cambios importantes y dejar reportes en Markdown para revisión posterior.

## Qué problema resuelve WorkingDocs

La oportunidad es convertir eso en un sistema que el manager pueda usar para:

- Enterarse de qué se trabajó aunque nadie documente
- Tener un resumen confiable por repo, semana o sprint
- Revisar decisiones, riesgos y archivos tocados
- Guardar todo en una memoria central consultable

## Cómo encaja WorkingDocs

WorkingDocs debería capturar ese caso de uso como un **repo audit agent** o **work summary agent**. El flujo sería: analizar commits, diffs y contexto del repo; inferir qué cambió; redactar un resumen humano; y guardarlo en la web app para que el equipo lo consulte después.

## Diferencia frente a solo usar Cursor

Cursor ayuda a hacer la auditoría, pero WorkingDocs agrega la capa que falta:

- Persistencia
- Historial y búsqueda
- Colaboración
- Dashboard por equipo
- Recordatorio de lo que no se documentó

## Nombre del caso de uso

> "Automated repo auditing and work summarization for teams that need documentation memory."

Esto separa a WorkingDocs de una wiki técnica genérica y lo acerca a una solución de **visibilidad operativa**.

## Conclusión

Este es el caso de uso correcto para WorkingDocs. No es una documentación tradicional, sino una **memoria automática de trabajo sobre repositorios** para cuando el equipo no documenta bien o no documenta a tiempo.