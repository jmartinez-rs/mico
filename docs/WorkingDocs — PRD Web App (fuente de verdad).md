# WorkingDocs — PRD Web App (fuente de verdad)

# PRD: WorkingDocs Web App

**Versión:** 1.0  
**Fecha:** 2026-08-18  
**Formato:** Web SaaS B2B

## 1) Resumen

WorkingDocs es una web app que captura resúmenes de trabajo, decisiones, workflows y evidencia técnica, para convertir actividad de desarrollo en documentación viva. La app funciona como repositorio principal del conocimiento y luego puede conectarse con otras herramientas si el usuario lo decide.

## 2) Problema

Los equipos técnicos generan conocimiento todos los días, pero queda disperso entre IDEs, repos, chats y tickets. Eso hace que el contexto se pierda, la documentación manual se retrase y el conocimiento útil no quede accesible de forma estructurada.

## 3) Objetivo

Crear una experiencia web simple donde el usuario pueda guardar, revisar, buscar y versionar documentación generada automáticamente a partir de su trabajo real. La app debe reducir fricción y convertirse en la fuente de verdad del equipo para ese conocimiento operativo.

## 4) Usuario objetivo

- Desarrolladores
- Tech leads
- Product ops
- Technical writers
- Equipos de ingeniería que quieren dejar trazabilidad de lo que construyen

## 5) Propuesta de valor

WorkingDocs elimina el paso manual de resumir y ordenar lo realizado al final del trabajo. La web app guarda esos resúmenes en un espacio central, permite editarlos y mantiene la trazabilidad a la fuente original para que el conocimiento sea reutilizable y confiable.

## 6) Alcance MVP

### Incluye

- Login y workspace
- Dashboard principal con lista de sesiones o resúmenes
- Creación y edición manual/asistida de documentos
- Etiquetas por proyecto, módulo o tipo de trabajo
- Vista de evidencia y trazabilidad
- Búsqueda básica
- Historial de versiones
- Compartir por enlace interno

### No incluye

- Jira
- Confluence
- Automatización completa de publicación
- Marketplace de integraciones
- Analítica avanzada
- Multi-tenancy enterprise compleja desde el día 1

## 7) Casos de uso

- Guardar el resumen de lo implementado en una sesión
- Documentar una decisión técnica importante
- Crear un historial por proyecto o módulo
- Buscar rápidamente qué se hizo y por qué
- Compartir un resumen con el equipo sin usar otra herramienta

## 8) Flujo principal

1. El usuario entra a la web app
2. Crea o importa un resumen de su trabajo
3. La app organiza el contenido por proyecto, fecha o etiqueta
4. El usuario revisa, corrige y guarda
5. Otro miembro del equipo consulta el contexto desde la misma app

## 9) Funcionalidades clave

- Dashboard con documentos recientes
- Editor simple con autosave
- Tags y filtros
- Búsqueda por texto
- Versionado básico
- Comentarios o notas internas
- Permisos por workspace
- Vista de fuente o evidencia asociada

## 10) Requisitos no funcionales

- Interfaz rápida y simple
- Buen soporte móvil y desktop
- Búsqueda confiable
- Seguridad por workspace
- Trazabilidad en cada documento
- Escalabilidad para crecimiento de contenido

## 11) Métricas de éxito

- Documentos creados por semana
- Tasa de retorno semanal de usuarios
- Tiempo promedio para guardar un resumen
- Número de búsquedas exitosas
- Tasa de edición posterior al contenido generado
- Tasa de uso por workspace

## 12) Riesgos

- Que la app sea solo un "notebook bonito" sin ventaja clara
- Que el usuario no vea suficiente valor sin integraciones desde el inicio
- Que la búsqueda o la organización sean débiles
- Que no haya confianza si el contenido no muestra fuente o contexto

## 13) Principios de producto

- La web app es la fuente de verdad
- El usuario siempre puede editar
- El contexto importa más que el texto
- La simplicidad gana al inicio
- Las integraciones son opcionales, no obligatorias

## 14) Roadmap

- **Fase 1:** dashboard, editor, búsqueda, versionado, permisos
- **Fase 2:** importación automática desde repos o sesiones
- **Fase 3:** exportación e integraciones externas
- **Fase 4:** automatización y recomendaciones inteligentes

## 15) Definición de éxito del MVP

El MVP es exitoso si un equipo puede usar la app durante una semana para guardar trabajo real, encontrar contexto rápido y recuperar información sin depender de documentos sueltos o notas dispersas.