# WorkingDocs — PRD (Product Requirements Document)

# PRD: WorkingDocs

**Owner:** Jose Martinez  
**Fecha:** 2026-08-18  
**Estado:** Draft

## 1) Problema

La documentación de trabajo se desactualiza rápido, vive dispersa y depende de esfuerzo manual. Eso hace que onboarding, soporte interno y ejecución operativa sean más lentos y más propensos a errores.

## 2) Objetivo

Convertir workflows reales en documentación viva, trazable y actualizada automáticamente, reduciendo el trabajo manual de documentar y mejorando la confianza en la información.

## 3) Usuario principal

Equipos de ingeniería, platform, operaciones, product ops y technical writers que trabajan con repositorios, tickets, chats y pipelines de entrega.

## 4) Propuesta de valor

WorkingDocs observa señales de trabajo real y genera documentación automáticamente con evidencia de origen. La plataforma no reemplaza al humano: le ahorra captura, orden y mantenimiento, y le deja revisión donde hace falta.

## 5) Alcance MVP

### In scope

- Conector a GitHub o GitLab
- Ingesta de repositorio y cambios
- Generación de documentación para un flujo concreto
- Citas o links a fuentes
- Búsqueda simple
- Aprobación humana antes de publicar

### Out of scope

- Wiki generalista
- Soporte para todos los sistemas internos desde el día 1
- Automatización total sin revisión
- Reemplazo de monitoreo u observabilidad de infraestructura

## 6) Casos de uso

- Documentar APIs y servicios a partir del código
- Mantener runbooks y SOPs actualizados
- Documentar procesos de onboarding
- Convertir cambios en tickets, PRs y chats en conocimiento reutilizable

## 7) Éxito medible

- 50%+ de documentación actualizada automáticamente en el flujo piloto
- 30% menos tiempo dedicado a documentar manualmente
- Reducción de tickets internos por falta de contexto
- Aumento en velocidad de onboarding
- Tasa alta de aprobación de docs generadas por el sistema

## 8) Riesgos

- Documentación incorrecta o demasiado inferida
- Baja confianza si no hay trazabilidad
- Integraciones demasiado amplias para el MVP
- Dificultad para definir cuándo actualizar y cuándo pedir revisión humana

## 9) Supuestos

- El primer valor aparece en un flujo específico, no en toda la empresa
- La trazabilidad a fuentes es obligatoria
- La revisión humana sigue siendo parte del sistema al inicio
- La adopción crece si ahorra tiempo real y reduce fricción operativa

## 10) Próximo paso

Construir un MVP enfocado en un solo flujo: documentación de APIs o documentación de workflows internos, porque es el mejor balance entre valor, precisión y complejidad.