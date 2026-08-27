# WorkingDocs — Taxonomía de Skills (referencia: claude-blog)

# WorkingDocs — Taxonomía de Skills (referencia: claude-blog)

## Skills que sí copiar (adaptadas)

| Skill claude-blog | Para qué sirve ahí | Versión WorkingDocs |
| --- | --- | --- |
| Orchestrator | Rutea comandos al skill correcto | Orquestador que decide: auditar repo, resumir sprint, detectar huecos, publicar |
| blog-analyze | Evalúa calidad del contenido | audit-analyze: score del resumen, cobertura y confianza |
| blog-audit | Revisa estado general del sitio | repo-audit: salud del repo, actividad reciente, cambios importantes |
| blog-brief | Genera briefs de contenido | work-brief: resumen ejecutivo del trabajo en una ventana temporal |
| blog-outline | Estructura un artículo antes de escribir | summary-outline: estructura del informe antes de redactar |
| blog-rewrite | Mejora contenido existente | summary-refine: reescribir o enriquecer un resumen generado |
| blog-factcheck | Verifica afirmaciones con fuentes | evidence-check: validar que el resumen esté respaldado por commits/diffs |
| blog-reviewer | Gate de calidad bloqueante | audit-reviewer: bloquear resúmenes pobres o sin evidencia suficiente |
| blog-flow | Framework de prompts por etapas | Flujo: find → inspect → synthesize → verify → publish |
| blog-cannibalization | Detecta solapamiento temático | duplicate-work-detector: detectar trabajo repetido o resúmenes duplicados |

## Skills que NO copiar (específicos de blogs/SEO)

| Skill claude-blog | Por qué no conviene | Alternativa WorkingDocs |
| --- | --- | --- |
| blog-seo, blog-geo, blog-schema | Ranking y blogs públicos | Solo si exportás docs públicas/indexables |
| blog-image, blog-audio, blog-video | Marketing de contenido | No es núcleo de auditoría |
| blog-multilingual, blog-translate | Contenido global | Fuera del MVP |

## Skills nuevas para WorkingDocs

| Skill | Qué hace |
| --- | --- |
| repo-scan | Lee commits, PRs, diffs y archivos tocados |
| change-cluster | Agrupa cambios por tema o sesión |
| work-summary | Redacta el resumen humano del trabajo |
| missing-docs | Detecta ausencia de documentación |
| confidence-score | Puntúa confiabilidad del resumen |
| manager-view | Genera vista ejecutiva para líderes |

## Lección de claude-blog

El valor real no está en tener muchas skills, sino en **skills pequeñas, bien nombradas y con responsabilidad única**. Eso hace el sistema extensible: hoy audita repos, mañana genera resúmenes semanales, detecta huecos o reportes de equipo sin rehacer todo el producto.