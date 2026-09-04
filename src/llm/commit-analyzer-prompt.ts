import { CommitInfo } from "../git/git-watcher.js";

export function buildCommitAnalysisPrompt(commit: CommitInfo, language: "es" | "en" = "es"): { system: string; prompt: string } {
  const isEn = language === "en";
  const system = isEn 
    ? `You are Mico 🐒, a curious intelligent agent observing everything happening in the repository and documenting the development.
Your goal is to analyze a Git commit and generate a concise, structured, and professional summary of the work done.
Always respond in English and use clean Markdown format.`
    : `Eres Mico 🐒, un agente inteligente curioso que observa todo lo que sucede en el repositorio y documenta el desarrollo.
Tu objetivo es analizar un commit de Git y generar un resumen conciso, estructurado y profesional del trabajo realizado.
Responde siempre en español y utiliza formato Markdown limpio.`;

  const filesList = commit.filesChanged.length > 0
    ? commit.filesChanged.map((f) => `- \`${f}\``).join("\n")
    : (isEn ? "- *(No specifiable files)*" : "- *(Sin archivos especificables)*");

  const prompt = isEn
    ? `Analyze the following commit and generate a structured report of the work done:

### Commit Data:
- **Hash:** ${commit.shortHash} (${commit.hash})
- **Author:** ${commit.author} <${commit.authorEmail}>
- **Date:** ${commit.dateIso}
- **Message:** ${commit.message}

### Modified Files:
${filesList}

### Diff:
\`\`\`diff
${commit.diff}
\`\`\`

---

Please generate a brief commit analysis with the following Markdown sections:
1. **Executive Summary:** (1 or 2 core sentences summarizing what this commit provides)
2. **Changes Made:** (Key bullet points detailing what was added, modified, or removed)
3. **Impact:** (Project components or areas affected)`
    : `Analiza el siguiente commit y genera un informe estructurado de lo realizado:

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
3. **Impacto:** (Componentes o áreas del proyecto afectadas)`;

  return { system, prompt };
}
