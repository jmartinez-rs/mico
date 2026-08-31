import fs from "fs/promises";
import path from "path";

export interface AgentState {
  processedHashes: string[];
  lastCheckedAt: string;
}

export class AgentStateStore {
  private filePath: string;
  private memorySet: Set<string> = new Set();

  constructor(filePath: string = "./data/mico-state.json") {
    this.filePath = path.resolve(filePath);
  }

  /**
   * Carga el estado guardado previamente en el archivo JSON.
   */
  async load(): Promise<Set<string>> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed: AgentState = JSON.parse(data);
      this.memorySet = new Set(parsed.processedHashes || []);
    } catch {
      // Si el archivo no existe o falla el parseo, iniciamos con conjunto vacío
      this.memorySet = new Set();
    }
    return this.memorySet;
  }

  /**
   * Retorna los hashes cargados en memoria.
   */
  getProcessedHashes(): Set<string> {
    return this.memorySet;
  }

  /**
   * Verifica si un hash ya fue procesado.
   */
  has(hash: string): boolean {
    return this.memorySet.has(hash);
  }

  /**
   * Registra un hash de commit como procesado y guarda el archivo en disco.
   */
  async markAsProcessed(hash: string): Promise<void> {
    this.memorySet.add(hash);
    await this.save();
  }

  /**
   * Registra múltiples hashes como procesados y guarda en disco.
   */
  async markManyAsProcessed(hashes: string[]): Promise<void> {
    for (const h of hashes) {
      this.memorySet.add(h);
    }
    await this.save();
  }

  /**
   * Guarda el estado actual en el archivo JSON.
   */
  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const state: AgentState = {
      processedHashes: Array.from(this.memorySet),
      lastCheckedAt: new Date().toISOString(),
    };

    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }
}
