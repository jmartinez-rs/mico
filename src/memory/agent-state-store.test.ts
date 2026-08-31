import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { AgentStateStore } from "./agent-state-store.js";

describe("AgentStateStore", () => {
  let tempDir: string;
  let stateFilePath: string;
  let store: AgentStateStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mico-state-test-"));
    stateFilePath = path.join(tempDir, "state.json");
    store = new AgentStateStore(stateFilePath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("inicia vacío y persiste hashes marcados como procesados", async () => {
    const initial = await store.load();
    expect(initial.size).toBe(0);

    await store.markAsProcessed("hash1");
    expect(store.has("hash1")).toBe(true);
    expect(store.has("hash2")).toBe(false);

    // Cargar en una nueva instancia para verificar la lectura desde el disco
    const newStore = new AgentStateStore(stateFilePath);
    const loaded = await newStore.load();
    expect(loaded.has("hash1")).toBe(true);
  });
});
