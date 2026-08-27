# WorkingDocs — Stack Tecnológico y Arquitectura Monorepo

# WorkingDocs — Stack Tecnológico y Arquitectura Monorepo

## Recomendación: TypeScript + Monorepo

Usar un monorepo TypeScript para reutilizar código entre CLI, backend y frontend.

### Estructura

```
workingdocs/
├── apps/
│   ├── cli/          # Agente local
│   ├── web/          # Frontend (Next.js)
│   └── api/          # Backend/API
├── packages/
│   ├── github/       # Cliente GitHub
│   ├── llm/          # Proveedores LLM
│   ├── markdown/     # Generación de documentos
│   ├── core/         # Modelos y lógica común
│   └── config/       # Configuración
└── package.json
```

## ¿Por qué TypeScript?

- Reutiliza código entre CLI, backend y frontend
- Comparte tipos y modelos entre todas las capas
- Excelente soporte para GitHub, OpenAI, Anthropic y MCP
- Facilita crear API web sobre la lógica existente
- Encaja con Next.js, React y arquitecturas modernas
- Reduce errores mediante tipado estático
- Permite empezar con CLI y evolucionar sin reescribir

## Stack sugerido

| Componente | Tecnología |
| --- | --- |
| Lenguaje | TypeScript |
| Runtime | Node.js |
| Monorepo | pnpm + Turborepo |
| Web | Next.js |
| UI  | React |
| CLI | Commander.js |
| GitHub | Octokit |
| Validación | Zod |
| LLM | Vercel AI SDK |
| Tests | Vitest |

## Flujo futuro

**MVP local:**

```
workingdocs generate --repo owner/repo --pr 123 --output ./docs
```

**Aplicación web:**

```
Usuario → Web → API → GitHub → LLM → Markdown
```

## Integración con LLM

```typescript
export interface LLMProvider {
  generate(input: GenerationInput): Promise<string>;
}
```

Implementaciones: `AnthropicProvider`, `OpenAIProvider`, `CompatibleProvider`

La API key debe permanecer **únicamente en el backend o entorno local** — nunca exponerla en el frontend.

## Evolución por fases

| Fase | Descripción |
| --- | --- |
| 1\. CLI local | Lee PR → obtiene commits/diffs → llama LLM → guarda Markdown |
| 2\. API | Expone generación vía endpoints, gestiona auth y claves |
| 3\. Web App | Conecta repos desde UI, selecciona PRs, muestra/edita docs |
| 4\. Automatización | Webhooks, generación al merge de PR, publicación, MCP |

## Decisión final

**TypeScript + Node.js** es la mejor trayectoria para WorkingDocs. Python sería preferible solo si el núcleo evoluciona hacia procesamiento intensivo de datos, ML propio o pipelines científicos.