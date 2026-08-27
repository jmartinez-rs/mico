# WorkingDocs — Sesión de Documentación Activa

# WorkingDocs — Sesión de Documentación Activa

## Visión

El MVP evolucionará a un modo de sesión de documentación activa: el usuario inicia una sesión vinculada a una rama/repo, el agente captura actividad periódicamente, y al finalizar genera el Markdown consolidado.

## Flujo de uso

### 1\. Iniciar sesión

```bash
workingdocs start --repo owner/repository --branch feature/login
```

```json
{
  "sessionId": "sess_abc123",
  "status": "active",
  "expiresAt": "2026-08-23T03:17:00Z"
}
```

### 2\. Durante el trabajo

El agente detecta:

- Nuevos commits en la rama
- Pull requests creados o actualizados
- Nuevos commits asociados a un PR
- Cambios en archivos y mensajes de commit

Cada elemento se almacena como contexto, evitando duplicados mediante SHA o número de PR.

### 3\. Finalizar manualmente

```bash
workingdocs finish sess_abc123
```

O vía REST:

```
POST /v1/sessions/sess_abc123/finish
```

Al finalizar:

1. Se detiene la captura
2. Se consolida toda la actividad
3. Se genera el documento Markdown
4. Se guarda en la carpeta configurada

### 4\. Finalización automática

Si no se ejecuta finish, la sesión expira automáticamente después de 24 horas y genera el documento con la información recopilada.

## Endpoints

```
POST /v1/sessions
GET  /v1/sessions/:id
POST /v1/sessions/:id/finish
POST /v1/sessions/:id/cancel
GET  /v1/sessions/:id/events
```

Request inicial:

```json
{
  "repository": "owner/repository",
  "branch": "feature/login",
  "pollIntervalSeconds": 60,
  "ttlHours": 24
}
```

## Implementación inicial (MVP)

Servicio con **polling** cada 60 segundos:

1. Consultar commits de la rama
2. Comparar con el último SHA conocido
3. Consultar PRs relacionados
4. Guardar únicamente actividad nueva

Webhooks de GitHub se pueden añadir más adelante.

## Persistencia

```
/data/
├── sessions/
│   └── sess_abc123.json
├── events/
│   └── sess_abc123.jsonl
└── docs/
    └── sessions/
        └── sess_abc123-feature-login.md
```

Permite reiniciar sin perder la sesión activa.

## Documento final generado

```markdown
# Sesión de desarrollo: feature/login

- Repositorio: owner/repository
- Rama: feature/login
- Inicio / Fin / Duración

## Resumen
...

## Commits registrados
### a1b2c3d — Implementación del login
...

## Pull requests relacionados
- PR #123 — Feature login

## Cambios principales / Decisiones / Riesgos

## Fuentes
- Enlaces a commits, PRs, archivos modificados
```

## Decisión recomendada para el MVP

- Inicio manual de sesión
- Una rama y repositorio por sesión
- Captura mediante polling
- Commits y PRs
- Finalización manual
- TTL configurable (24h por defecto)
- Generación automática al finalizar o expirar
- Persistencia local en archivos JSON/JSONL

> El proceso de captura debe ejecutarse como job en segundo plano, no bloquear la petición HTTP de inicio.