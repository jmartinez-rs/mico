# WorkingDocs — Posicionamiento vs Wiki Técnica

# WorkingDocs vs Wiki Técnica (Posicionamiento)

## Diferencia central

WorkingDocs se diferencia si deja de ser "documentación del repositorio" y pasa a ser **"documentación del trabajo"**. Una wiki técnica basada en repositorios vive pegada al código y suele guardar arquitectura, guías, runbooks y referencias versionadas; WorkingDocs, en cambio, captura sesiones de trabajo, decisiones, resúmenes y evidencia de lo que se hizo, aunque luego pueda exportarse a una wiki o a otras herramientas.

## La wiki repo-céntrica responde

- "¿Cómo funciona este sistema?"
- "¿Dónde está la documentación técnica del proyecto?"

## WorkingDocs responde

- "¿Qué hice hoy?"
- "¿Por qué tomé esta decisión?"
- "¿Cómo dejo esto listo para compartir o auditar?"

## Qué documenta cada una

| Wiki técnica | WorkingDocs |
| --- | --- |
| Arquitectura, APIs, configuración, guías de uso | Resúmenes de trabajo, cambios realizados |
| Decisiones estables, conocimiento cercano al código | Contexto de implementación, decisiones |
| —   | Pendientes y trazabilidad del proceso |

## Cómo se crea y mantiene

- **Wiki basada en repositorios:** el contenido se edita manualmente o por PR, pensado para evolucionar junto con el código.
- **WorkingDocs:** el contenido nace automáticamente del trabajo diario, con revisión posterior si hace falta, para evitar el paso manual de "sentarme a documentar".

## Dónde gana WorkingDocs

WorkingDocs gana cuando el valor está en el **flujo**, no en el repositorio. Si el usuario trabaja en Cursor, implementa, resume y guarda en la app, WorkingDocs reduce fricción y convierte actividad dispersa en conocimiento reutilizable. Una wiki técnica tradicional no suele resolver bien ese paso entre trabajo y documentación.

## En una frase

> La wiki técnica documenta el sistema; WorkingDocs documenta el proceso que construye el sistema.