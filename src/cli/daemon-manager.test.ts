import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  daemonPaths,
  isProcessAlive,
  readPid,
  startDaemon,
  statusDaemon,
  stopDaemon,
  type DaemonOptions,
} from "./daemon-manager.js";

describe("daemon-manager", () => {
  let tempDir: string;
  let entry: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mico-daemon-test-"));
    // Entry point real: escribe un marcador y queda vivo hasta que lo maten.
    entry = join(tempDir, "fake-daemon.js");
    await writeFile(
      entry,
      `const fs = require("fs");
fs.writeFileSync(${JSON.stringify(join(tempDir, "started.txt"))}, "started");
setInterval(() => {}, 1000);
`,
      "utf-8",
    );
  });

  afterEach(async () => {
    // Asegurar que no quede ningún proceso del test corriendo
    const pid = readPid({ cwd: tempDir });
    if (pid && isProcessAlive(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ya murió
      }
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  function options(): DaemonOptions {
    return { cwd: tempDir, entry };
  }

  it("startDaemon spawnea el proceso, guarda PID y status lo reporta corriendo", async () => {
    const { pid, paths } = await startDaemon(options());
    expect(pid).toBeGreaterThan(0);
    expect(paths.pidFile).toBe(daemonPaths(options()).pidFile);

    // El proceso arrancó (marcador escrito)
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await readFile(join(tempDir, "started.txt"), "utf-8")).toBe("started");

    // PID persistido y proceso vivo
    expect(readPid(options())).toBe(pid);
    expect(isProcessAlive(pid)).toBe(true);

    // statusDaemon reporta running con el PID
    const status = await statusDaemon(options());
    expect(status.running).toBe(true);
    expect(status.pid).toBe(pid);
  });

  it("startDaemon falla si ya hay un daemon corriendo", async () => {
    await startDaemon(options());
    await expect(startDaemon(options())).rejects.toThrow(/ya está corriendo/);
  });

  it("stopDaemon mata el proceso y limpia el PID", async () => {
    const { pid } = await startDaemon(options());
    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await stopDaemon(options());
    expect(result.stopped).toBe(true);
    expect(result.pid).toBe(pid);

    // El proceso ya no está vivo y el PID file fue removido
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(isProcessAlive(pid)).toBe(false);
    expect(readPid(options())).toBeNull();
    expect((await statusDaemon(options())).running).toBe(false);
  });

  it("stopDaemon sin daemon devuelve stopped:false", async () => {
    const result = await stopDaemon(options());
    expect(result.stopped).toBe(false);
  });

  it("statusDaemon reporta no corriendo sin PID file", async () => {
    const status = await statusDaemon(options());
    expect(status.running).toBe(false);
  });

  it("startDaemon falla si el entry point no existe", async () => {
    await expect(
      startDaemon({ cwd: tempDir, entry: join(tempDir, "no-existe.js") }),
    ).rejects.toThrow(/entry point/);
  });
});