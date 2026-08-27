# WorkingDocs — Integración MCP con Claude Code

# WorkingDocs — Integración MCP con Claude Code

## Contexto

Conectar WorkingDocs con la IA que ya usa el equipo, por ejemplo Claude Code vía MCP server, para que la documentación viva esté disponible dentro del mismo flujo de trabajo del desarrollador.

## Por qué es buena idea

Claude Code soporta MCP como estándar abierto para conectarse a herramientas, bases de datos y APIs externas, y puede registrar servidores remotos o locales con `claude mcp add`. Eso permite que WorkingDocs actúe como fuente de conocimiento, mientras Claude Code se convierte en la interfaz operativa para consultar, resumir o actualizar documentación sin salir del entorno de trabajo.

## Qué habilita

Con esa integración, el usuario podría:

- Preguntar por un workflow y recibir la documentación viva con trazabilidad
- Pedir que se genere o actualice una doc desde cambios en el repo
- Revisar impactos de un cambio antes de publicar
- Abrir una tarea de revisión cuando la confianza sea baja
- Usar la documentación dentro de la terminal o del editor donde ya trabaja

## Cómo lo haría

La arquitectura más limpia sería:

- **Backend:** indexa fuentes, genera docs y mantiene versionado
- **Servidor MCP:** expone herramientas como `search_docs`, `get_workflow`, `diff_docs`, `propose_update` y `publish_update`
- **Claude Code:** consume esas herramientas como `mcp__server__tool`, siguiendo el patrón soportado por MCP

## Ventaja estratégica

Eso mueve a WorkingDocs de "otra app de documentación" a una **infraestructura de documentación para agentes**. Además, como MCP es abierto, después se podrían integrar otros clientes sin rehacer todo el producto.

## Riesgos

- El principal reto es controlar permisos, auditoría y publicación, porque darle a un agente capacidad de leer y escribir docs requiere límites claros
- La decisión crítica debe estar en el servidor y no en el modelo: Claude debería consumir reglas, no inventarlas

## Recomendación

Sí: ponerlo como parte central del producto desde el inicio. Si la plataforma se integra nativamente con Claude Code vía MCP, la adopción baja de fricción y la propuesta se vuelve mucho más fuerte para equipos técnicos.