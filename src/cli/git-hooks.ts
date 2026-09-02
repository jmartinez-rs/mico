/**
 * Gestión del hook de git `post-commit` de Mico.
 *
 * El hook se ejecuta automáticamente después de cada `git commit` y dispara
 * `mico run-once` en segundo plano (sin bloquear el flujo de git), de modo que
 * Mico documenta el commit sin necesidad de un daemon corriendo.
 */
import fs from "node:fs";
import path from "node:path";

/** Marcador que identifica un hook instalado por Mico (para uninstall seguro). */
export const MICO_HOOK_MARKER = "# Mico 🐒 post-commit hook";

/** Comando por defecto que ejecuta el hook (procesa commits pendientes). */
export const DEFAULT_HOOK_COMMAND = "npx mico-agent run-once";

/** Construye el contenido del script del hook. */
export function buildHookScript(command: string = DEFAULT_HOOK_COMMAND): string {
  return `#!/bin/sh
${MICO_HOOK_MARKER}
# Instalado por \`mico hook install\`. Procesa el commit recién creado
# en segundo plano sin bloquear el flujo de git.
nohup ${command} >/dev/null 2>&1 &
`;
}

/** Devuelve true si el contenido del hook fue generado por Mico. */
export function isMicoHook(content: string): boolean {
  return content.includes(MICO_HOOK_MARKER);
}

/** Ruta del hook post-commit dentro del repo. */
export function hookPath(repoPath: string): string {
  return path.join(repoPath, ".git", "hooks", "post-commit");
}

/**
 * Instala el hook `post-commit` en el repo. Lanza un error si el repo no tiene
 * `.git` o si ya existe un hook que NO fue instalado por Mico (no lo pisa).
 * Devuelve la ruta del hook instalado.
 */
export async function installGitHook(
  repoPath: string,
  options: { command?: string } = {},
): Promise<string> {
  const gitDir = path.join(repoPath, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error(
      `No se encontró el directorio .git en "${repoPath}". ¿Es un repositorio git?`,
    );
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const target = hookPath(repoPath);
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, "utf-8");
    if (!isMicoHook(existing)) {
      throw new Error(
        `Ya existe un hook post-commit en "${target}" que no fue instalado por Mico. No se sobrescribe.`,
      );
    }
  }

  const script = buildHookScript(options.command);
  fs.writeFileSync(target, script, { mode: 0o755 });
  return target;
}

/**
 * Desinstala el hook `post-commit` SOLO si fue instalado por Mico. Devuelve
 * true si lo removió, false si no existía o no era de Mico.
 */
export async function uninstallGitHook(repoPath: string): Promise<boolean> {
  const target = hookPath(repoPath);
  if (!fs.existsSync(target)) {
    return false;
  }
  const existing = fs.readFileSync(target, "utf-8");
  if (!isMicoHook(existing)) {
    return false;
  }
  fs.unlinkSync(target);
  return true;
}