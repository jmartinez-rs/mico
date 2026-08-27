# WorkingDocs — PRD Docs Agent (agente local)

# PRD: WorkingDocs Docs Agent

**Versión:** 1.0  
**Fecha:** 2026-08-18  
**Producto:** Agente local de documentación + plataforma web

## 1) Visión

Convertir el trabajo técnico diario en documentación útil de forma automática, con un agente liviano que capta el contexto directamente desde la carpeta de trabajo y envía borradores a una plataforma central para revisión y publicación.

## 2) Problema

Los equipos técnicos generan conocimiento mientras trabajan, pero ese conocimiento se pierde, se escribe tarde o queda incompleto. La documentación manual compite con el tiempo de desarrollo y casi nunca captura bien el contexto real.

## 3) Solución

WorkingDocs Docs Agent se instala localmente en el workspace del usuario, monitorea cambios relevantes, agrupa actividad por sesión o unidad de trabajo y genera un borrador de documentación que se sincroniza con la web app de WorkingDocs.

## 4) Usuario objetivo

- Desarrolladores
- Tech leads
- Product engineers
- Technical writers
- Equipos que usan repos locales, Cursor o flujos de trabajo con múltiples archivos y cambios frecuentes

## 5) Propuesta de valor

El agente convierte la documentación en un subproducto del trabajo, no en una tarea extra. Reduce fricción, mejora trazabilidad y permite que el conocimiento se capture mientras todavía está fresco.

## 6) Casos de uso

- Resumir una sesión de implementación al cerrar el trabajo
- Detectar cambios significativos en una carpeta y redactar notas
- Preparar documentación de refactorizaciones o decisiones técnicas
- Mantener un historial de lo hecho por proyecto
- Enviar borradores listos para revisión a la web app

## 7) Alcance MVP

### Incluye

- Instalación en una carpeta de trabajo
- Monitoreo de archivos y eventos del workspace
- Agrupación de cambios por sesión
- Generación de borradores de documentación
- Sincronización segura con la web app
- Cola local de reintentos
- Configuración de exclusiones y privacidad

### No incluye

- Publicación directa a Jira o Confluence
- UI compleja dentro del agente
- Observabilidad de runtime o performance
- Soporte universal para todos los lenguajes y herramientas
- Automatización total sin revisión humana

## 8) Flujo del usuario

1. Instala el agente en la carpeta del proyecto
2. El agente observa actividad en el workspace
3. Detecta una unidad lógica de trabajo
4. Genera un borrador de documentación
5. Envía el borrador a la web app
6. El usuario revisa, corrige y publica

## 9) Requisitos funcionales

- Detectar cambios en archivos relevantes
- Agrupar actividad por sesión o evento
- Generar resúmenes con contexto
- Clasificar el tipo de contenido generado
- Sincronizar borradores con el backend
- Permitir exclusiones por carpeta o patrón
- Reintentar envío en caso de fallo de red

## 10) Requisitos no funcionales

- Debe ser liviano y rápido
- Debe consumir pocos recursos
- Debe funcionar offline con sincronización posterior
- Debe respetar la privacidad del usuario
- Debe ser fácil de instalar y configurar
- Debe ser confiable y observable

## 11) Guardrails

- No documentar cambios triviales
- No subir contenido sensible por defecto
- No sobrescribir documentos sin revisión
- No inventar contexto no observado
- No actuar fuera de rutas permitidas

## 12) Métricas de éxito

- Sesiones capturadas automáticamente
- Porcentaje de borradores útiles
- Tiempo ahorrado por sesión
- Tasa de instalación activa
- Tasa de sincronización exitosa
- Reducción del trabajo manual de documentación

## 13) Riesgos

- Ruido excesivo por demasiados cambios
- Resúmenes de baja calidad si falta contexto
- Problemas de privacidad o confianza
- Instalación demasiado compleja
- Baja adopción si el agente no ahorra tiempo real

## 14) Supuestos

- El usuario trabaja de forma repetitiva en una carpeta o proyecto definido
- Hay señales suficientes para inferir unidades de trabajo
- El usuario aceptará revisar un borrador en lugar de escribir desde cero
- La documentación útil nace mejor cerca del flujo de trabajo que después de terminado

## 15) Éxito del MVP

El MVP triunfa si un desarrollador puede instalar el agente rápido, trabajar una semana normal y ver que parte significativa de su trabajo queda documentada sin tener que interrumpir su flujo.

## 16) Evolución futura

Más adelante, el agente podría integrarse con MCP, Cursor, GitHub y otras fuentes para enriquecer contexto. Aun así, el núcleo seguiría siendo el mismo: capturar trabajo real y transformarlo en documentación viva.