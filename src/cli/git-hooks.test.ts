import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_HOOK_COMMAND,
  MICO_HOOK_MARKER,
  buildHookScript,
  hookPath,
  installGitHook,
  isMicoHook,
  uninstallGitHook,
} from "./git-hooks.js";

const execFileAsync = promisify(execFile);

async function runGit(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: dir });
  return stdout.trim();
}

describe("git-hooks", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mico-hook-test-"));
    await runGit(tempDir, ["init", "-b", "main"]);
    await runGit(tempDir, ["config", "user.email", "test@example.com"]);
    await runGit(tempDir, ["config", "user.name", "Test Dev"]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("buildHookScript genera un script ejecutable con el marcador de Mico", () => {
    const script = buildHookScript();
    expect(script).toContain("#!/bin/sh");
    expect(script).toContain(MICO_HOOK_MARKER);
    expect(script).toContain(DEFAULT_HOOK_COMMAND);
    expect(script).toContain("nohup");
  });

  it("isMicoHook distingue hooks de Mico de otros", () => {
    expect(isMicoHook(buildHookScript())).toBe(true);
    expect(isMicoHook("#!/bin/sh\necho hola")).toBe(false);
  });

  it("instala el hook post-commit con permisos de ejecución", async () => {
    const target = await installGitHook(tempDir);
    expect(target).toBe(hookPath(tempDir));

    const content = await readFile(target, "utf-8");
    expect(content).toContain(MICO_HOOK_MARKER);

    // Permisos de ejecución
    const { stdout } = await execFileAsync("stat", ["-c", "%a", target]);
    expect(stdout.trim()).toMatch(/7\d\d/);
  });

  it("es idempotente: reinstalar sobre un hook de Mico no falla", async () => {
    await installGitHook(tempDir);
    await expect(installGitHook(tempDir)).resolves.toBe(hookPath(tempDir));
  });

  it("no sobrescribe un hook existente que no es de Mico", async () => {
    const target = hookPath(tempDir);
    await writeFile(target, "#!/bin/sh\necho hook del usuario\n", { mode: 0o755 });

    await expect(installGitHook(tempDir)).rejects.toThrow(/no fue instalado por Mico/);
    const content = await readFile(target, "utf-8");
    expect(content).toContain("hook del usuario");
  });

  it("lanza error si el repo no tiene .git", async () => {
    const noGit = await mkdtemp(join(tmpdir(), "mico-nogit-"));
    try {
      await expect(installGitHook(noGit)).rejects.toThrow(/\.git/);
    } finally {
      await rm(noGit, { recursive: true, force: true });
    }
  });

  it("uninstallGitHook remueve solo hooks de Mico", async () => {
    await installGitHook(tempDir);
    expect(await uninstallGitHook(tempDir)).toBe(true);
    await expect(readFile(hookPath(tempDir), "utf-8")).rejects.toThrow();

    // No existía => false
    expect(await uninstallGitHook(tempDir)).toBe(false);

    // Hook de usuario => no lo toca
    const target = hookPath(tempDir);
    await writeFile(target, "#!/bin/sh\necho usuario\n", { mode: 0o755 });
    expect(await uninstallGitHook(tempDir)).toBe(false);
    expect(await readFile(target, "utf-8")).toContain("usuario");
  });

  it("el hook instalado se ejecuta tras un commit (smoke real)", async () => {
    const markerFile = join(tempDir, "hook-ran.txt");
    const target = await installGitHook(tempDir, {
      // El hook envuelve el comando con `>/dev/null 2>&1`, así que el comando
      // debe redirigir internamente (sh -c) para escribir el marcador.
      command: `sh -c 'echo "mico-hook-ejecutado" >> ${markerFile}'`,
    });
    expect(target).toBe(hookPath(tempDir));

    await writeFile(join(tempDir, "file.txt"), "hola\n", "utf-8");
    await runGit(tempDir, ["add", "file.txt"]);
    await runGit(tempDir, ["commit", "-m", "feat: probar hook"]);

    // El hook corre en background; esperamos un instante
    await new Promise((resolve) => setTimeout(resolve, 500));
    const marker = await readFile(markerFile, "utf-8");
    expect(marker).toContain("mico-hook-ejecutado");
  });
});