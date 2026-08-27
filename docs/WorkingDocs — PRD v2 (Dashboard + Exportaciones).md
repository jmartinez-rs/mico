# WorkingDocs — PRD v2 (Dashboard + Exportaciones)

# PRD: WorkingDocs — v2.0 (Dashboard + Exportaciones)

**Versión:** 1.0  
**Fecha:** 2026-08-18  
**Tipo:** Web app SaaS B2B

## 1) Visión

WorkingDocs convierte el trabajo real del equipo en documentación viva, resumida y trazable. La aplicación centraliza lo generado desde el flujo de desarrollo y permite exportarlo o sincronizarlo con herramientas externas cuando el usuario lo decida.

## 2) Problema

Los equipos trabajan en Cursor, GitHub, Jira, Confluence y chat, pero el conocimiento queda disperso. El resultado es documentación manual, duplicada y desactualizada, con mucho esfuerzo para pasar de "lo que pasó" a "lo que quedó documentado".

## 3) Objetivo del producto

Crear una dashboard donde se guarden automáticamente resúmenes, decisiones, workflows y evidencia del trabajo realizado, y desde donde el usuario pueda exportar o sincronizar contenido con Jira, Confluence u otras herramientas.

## 4) Usuarios objetivo

- Desarrolladores
- Tech leads
- Product ops
- Technical writers
- Equipos de ingeniería que usan Cursor, GitHub, Jira y Confluence

## 5) Propuesta de valor

La app elimina el paso manual de "terminé de programar y ahora tengo que documentarlo". En vez de copiar y pegar entre herramientas, el usuario recibe una dashboard que captura el contexto, lo organiza y lo convierte en documentación reutilizable.

## 6) Alcance MVP

### Incluye

- Dashboard web con login
- Guardado de resúmenes y notas de trabajo
- Conector a GitHub o GitLab
- Conector opcional a Cursor o MCP-compatible clients
- Exportar a Jira y Confluence
- Búsqueda básica
- Historial de versiones
- Evidencia enlazada a commits, PRs o tickets

### No incluye

- Reemplazar Jira o Confluence
- Soportar todas las integraciones desde el día 1
- Automatización total sin revisión humana
- Analítica avanzada en la primera versión

## 7) Flujo principal

1. El usuario trabaja en su repo
2. La IA genera un resumen de lo hecho
3. El resumen se guarda en WorkingDocs
4. El usuario revisa y ajusta si hace falta
5. Desde la dashboard, exporta a Jira, Confluence o ambos

## 8) Funcionalidades clave

- Dashboard con lista de sesiones, resúmenes y workflows
- Editor simple para ajustar texto antes de publicar
- Tags por proyecto, módulo o flujo
- Vista de trazabilidad con fuentes
- Botón "Exportar a Jira"
- Botón "Publicar en Confluence"
- Estado de sincronización por destino
- Permisos por workspace o equipo

## 9) Integraciones

La primera versión debe priorizar una arquitectura con conectores, no dependencia total de un solo sistema. Jira y Confluence entran como destinos de publicación, mientras que GitHub y Cursor funcionan como fuentes de contexto.

## 10) Métricas de éxito

- % de resúmenes generados que se guardan en la dashboard
- % de resúmenes exportados a una herramienta externa
- Tiempo ahorrado por sesión de documentación
- Reducción de trabajo manual post-implementación
- Tasa de uso semanal de la dashboard
- Tasa de aprobación de contenido generado por IA

## 11) Riesgos

- Que la app se convierta en "otro lugar más" sin valor diferencial
- Que la sincronización con Jira/Confluence sea inconsistente
- Que el usuario no confíe en el resumen si falta evidencia
- Que el alcance de integraciones crezca demasiado rápido

## 12) Principios de diseño

- La dashboard es la fuente de verdad
- Las integraciones son salidas, no el núcleo
- Cada documento debe tener trazabilidad
- El usuario siempre puede editar antes de publicar
- La IA ayuda a capturar, no a inventar

## 13) Roadmap sugerido

- **Fase 1:** dashboard + guardado manual/asistido + exportación simple
- **Fase 2:** integraciones con Jira y Confluence
- **Fase 3:** conectores a Cursor/MCP, GitHub y más automatización
- **Fase 4:** clasificación inteligente, alertas de desactualización y flujos automáticos

## 14) Pregunta de producto

La gran decisión es si WorkingDocs será una herramienta de documentación o una capa de operación del conocimiento. Por cómo está definida, el mejor ángulo es el segundo: una dashboard que captura trabajo real y luego distribuye conocimiento a Jira, Confluence y otros destinos.