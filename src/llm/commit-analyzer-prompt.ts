import { CommitInfo } from "../git/git-watcher.js";

export function buildCommitAnalysisPrompt(commit: CommitInfo): { system: string; prompt: string } {
  const system = `Eres Mico 🐒, un agente inteligente curioso que observa todo lo que sucede en el repositorio y documenta el desarrollo.
Tu objetivo es analizar un commit de Git y generar un resumen conciso, estructurado y profesional del trabajo realizado.
Responde siempre en español y utiliza formato Markdown limpio.`;

  const filesList = commit.filesChanged.length > 0
    ? commit.filesChanged.map((f) => `- \`${f}\``).join("\n")
    : "- *(Sin archivos especificables)*";

  const prompt = `Analiza el siguiente commit y genera un informe estructurado de lo realizado:

### Datos del Commit:
- **Hash:** ${commit.shortHash} (${commit.hash})
- **Autor:** ${commit.author} <${commit.authorEmail}>
- **Fecha:** ${commit.dateIso}
- **Mensaje:** ${commit.message}

### Archivos modificados:
${filesList}

### Diff del cambio:
\`\`\`diff
${commit.diff}
\`\`\`

---

Por favor, genera un análisis breve del commit con las siguientes secciones en Markdown:
1. **Resumen Ejecutivo:** (1 o 2 oraciones principales de lo que aporta este commit)
2. **Cambios Realizados:** (Puntos clave detallando qué se agregó, modificó o eliminó)
3. **Impacto:** (Componentes o áreas del proyecto afectadas)
`;

  return { system, prompt };
}
