# PRD — Agente de Documentación Técnica (MVP)

# PRD — Agente de Documentación Técnica (MVP)

**Versión:** 0.1  
**Estado:** Propuesta MVP  
**Tecnología:** TypeScript + Node.js  
**Tipo:** Microservicio REST ligero

## 1\. Resumen

El agente recibe la información de un Pull Request de GitHub, analiza sus cambios mediante un LLM y genera un documento técnico en formato Markdown dentro de una carpeta configurada. El objetivo inicial es validar la generación automática de documentación trazable, sin interfaz web ni base de datos.

## 2\. Objetivo

Permitir que un usuario genere documentación técnica a partir de un Pull Request mediante una petición REST.

```
POST /v1/documents/from-pull-request
        ↓
GitHub + LLM
        ↓
/docs/pull-requests/123-feature-login.md
```

## 3\. Usuario objetivo

- Desarrolladores
- Tech leads
- Equipos pequeños de ingeniería
- Equipos que necesitan documentar cambios realizados en código

## 4\. Alcance del MVP

### Incluido

- API REST
- Integración con GitHub mediante REST API
- Lectura de un Pull Request
- Obtención de: título, descripción, autor, commits, archivos modificados, diff, reviews (si disponibles)
- Integración con un proveedor LLM
- Generación de documentación Markdown
- Escritura del archivo en una carpeta local
- Configuración mediante variables de entorno
- Validación de entradas
- Logs básicos