/**
 * Gestión del ciclo de vida de Mico como proceso en segundo plano.
 *
 * `startDaemon` spawnea `node <entry> start` con `detached: true` y `unref()`,
 * redirige stdout/stderr a un archivo de log y guarda el PID en
 * `data/mico.pid`. `stopDaemon` y `statusDaemon` operan sobre ese PID.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface DaemonOptions {
  /** Directorio del proyecto Mico (cwd del proceso). */
  cwd: string;
  /** Carpeta de datos (PID + logs). Default: `<cwd>/data`. */
  dataDir?: string;
  /** Entry point del CLI. Default: `<cwd>/dist/cli.js`. */
  entry?: string;
  /** Función spawn inyectable (para tests). */
  spawnFn?: typeof spawn;
}

export interface DaemonPaths {
  pidFile: string;
  logFile: string;
  errFile: string;
}

export function daemonPaths(options: DaemonOptions): DaemonPaths {
  const dataDir = options.dataDir ?? path.join(options.cwd, "data");
  return {
    pidFile: path.join(dataDir, "mico.pid"),
    logFile: path.join(dataDir, "mico-daemon.log"),
    errFile: path.join(dataDir, "mico-daemon.err.log"),
  };
}

/** Lee el PID guardado, o null si no existe / no es válido. */
export function readPid(options: DaemonOptions): number | null {
  const { pidFile } = daemonPaths(options);
  try {
    const raw = fs.readFileSync(pidFile, "utf-8").trim();
    const pid = parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Verifica si un proceso está vivo (SIG 0). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === "EPERM"; // existe pero no tenemos permisos
  }
}

/**
 * Inicia el daemon en segundo plano. Devuelve el PID y las rutas de log.
 * Lanza un error si ya hay un daemon corriendo.
 */
export async function startDaemon(
  options: DaemonOptions,
): Promise<{ pid: number; paths: DaemonPaths }> {
  const existing = readPid(options);
  if (existing && isProcessAlive(existing)) {
    throw new Error(`El daemon de Mico ya está corriendo (PID ${existing}).`);
  }

  const paths = daemonPaths(options);
  fs.mkdirSync(path.dirname(paths.pidFile), { recursive: true });

  const entry = options.entry ?? path.join(options.cwd, "dist", "cli.js");
  if (!fs.existsSync(entry)) {
    throw new Error(
      `No se encontró el entry point "${entry}". Ejecutá antes \`npm run build\`.`,
    );
  }

  const logFd = fs.openSync(paths.logFile, "a");
  const errFd = fs.openSync(paths.errFile, "a");
  const spawnFn = options.spawnFn ?? spawn;

  const child: ChildProcess = spawnFn(process.execPath, [entry, "start"], {
    cwd: options.cwd,
    detached: true,
    stdio: ["ignore", logFd, errFd],
  });

  child.unref();
  fs.writeFileSync(paths.pidFile, String(child.pid), "utf-8");
  return { pid: child.pid!, paths };
}

/**
 * Detiene el daemon (SIGTERM) y limpia el archivo PID. Devuelve si había un
 * proceso corriendo y lo detuvo.
 */
export async function stopDaemon(
  options: DaemonOptions,
): Promise<{ stopped: boolean; pid?: number }> {
  const pid = readPid(options);
  const { pidFile } = daemonPaths(options);

  if (!pid) {
    return { stopped: false };
  }

  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ya murió entre la verificación y el kill
    }
  }

  try {
    fs.unlinkSync(pidFile);
  } catch {
    // no importa si no existe
  }
  return { stopped: true, pid };
}

/** Estado del daemon: corriendo?, PID y últimas líneas del log. */
export async function statusDaemon(
  options: DaemonOptions,
): Promise<{ running: boolean; pid?: number; logTail?: string }> {
  const pid = readPid(options);
  const { logFile } = daemonPaths(options);

  if (!pid || !isProcessAlive(pid)) {
    return { running: false };
  }

  let logTail: string | undefined;
  try {
    const content = fs.readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    logTail = lines.slice(-15).join("\n");
  } catch {
    logTail = undefined;
  }

  return { running: true, pid, logTail };
}