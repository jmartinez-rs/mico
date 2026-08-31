import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { GitWatcher, normalizeRemoteUrl, remoteHost } from "./git-watcher.js";

const execFileAsync = promisify(execFile);

async function runGit(dir: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: dir });
  return stdout.trim();
}

describe("normalizeRemoteUrl", () => {
  it("normaliza URLs SSH (git@host:owner/repo.git) a owner/repo", () => {
    expect(normalizeRemoteUrl("git@github.com:owner/repo.git")).toBe(
      "owner/repo",
    );
  });

  it("normaliza URLs HTTPS con .git a owner/repo", () => {
    expect(normalizeRemoteUrl("https://github.com/owner/repo.git")).toBe(
      "owner/repo",
    );
  });

  it("normaliza URLs HTTPS sin .git", () => {
    expect(normalizeRemoteUrl("https://gitlab.com/group/project")).toBe(
      "group/project",
    );
  });

  it("conserva los últimos dos segmentos en repos con subgrupos", () => {
    expect(normalizeRemoteUrl("https://gitlab.com/group/sub/project.git")).toBe(
      "sub/project",
    );
  });

  it("limpia .git en formatos no reconocidos", () => {
    expect(normalizeRemoteUrl("file:///tmp/repo.git")).toBe("file:///tmp/repo");
  });
});

describe("remoteHost", () => {
  it("extrae el host de URLs SSH y HTTPS", () => {
    expect(remoteHost("git@github.com:owner/repo.git")).toBe("github.com");
    expect(remoteHost("https://gitlab.com/group/project")).toBe("gitlab.com");
    expect(remoteHost("file:///tmp/repo")).toBeNull();
  });
});

describe("GitWatcher (repo git real)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-git-test-"));
    await runGit(tempDir, ["init", "-b", "main"]);
    await runGit(tempDir, ["config", "user.email", "test@example.com"]);
    await runGit(tempDir, ["config", "user.name", "Test Dev"]);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("lee detalles completos de un commit", async () => {
    await fs.writeFile(path.join(tempDir, "file.txt"), "hola\n", "utf-8");
    await runGit(tempDir, ["add", "file.txt"]);
    await runGit(tempDir, ["commit", "-m", "feat: primer commit"]);

    const watcher = new GitWatcher(tempDir);
    const hashes = await watcher.getRecentHashes(5);
    expect(hashes.length).toBe(1);

    const details = await watcher.getCommitDetails(hashes[0]!);
    expect(details.author).toBe("Test Dev");
    expect(details.message).toContain("feat: primer commit");
    expect(details.filesChanged).toContain("file.txt");
    expect(details.diff).toContain("hola");
    expect(details.dateYYYYMMDD).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getUnprocessedCommits devuelve solo los no procesados, en orden cronológico", async () => {
    await fs.writeFile(path.join(tempDir, "a.txt"), "a\n", "utf-8");
    await runGit(tempDir, ["add", "a.txt"]);
    await runGit(tempDir, ["commit", "-m", "feat: a"]);
    await fs.writeFile(path.join(tempDir, "b.txt"), "b\n", "utf-8");
    await runGit(tempDir, ["add", "b.txt"]);
    await runGit(tempDir, ["commit", "-m", "feat: b"]);

    const watcher = new GitWatcher(tempDir);
    const hashes = await watcher.getRecentHashes(5);
    // Marcar el más reciente (b) como procesado => solo queda a
    const unprocessed = await watcher.getUnprocessedCommits(new Set([hashes[0]!]));
    expect(unprocessed.length).toBe(1);
    expect(unprocessed[0]!.message).toContain("feat: a");
  });

  it("getRemoteUrl devuelve null sin remote y el valor con remote origin", async () => {
    const watcher = new GitWatcher(tempDir);
    expect(await watcher.getRemoteUrl()).toBeNull();

    await runGit(tempDir, ["remote", "add", "origin", "git@github.com:owner/repo.git"]);
    expect(await watcher.getRemoteUrl()).toBe("git@github.com:owner/repo.git");
  });
});