import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedDocument } from "../domain/types.js";

/**
 * Índice persistente de documentos generados. Se guarda como JSON junto a la
 * carpeta de documentos para poder listar y recuperar tras reiniciar el proceso.
 */
export class DocumentStore {
  private readonly indexPath: string;

  constructor(documentsPath: string) {
    this.indexPath = join(documentsPath, "index.json");
  }

  private async readIndex(): Promise<GeneratedDocument[]> {
    try {
      const raw = await readFile(this.indexPath, "utf8");
      return JSON.parse(raw) as GeneratedDocument[];
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }

  private async writeIndex(documents: GeneratedDocument[]): Promise<void> {
    await mkdir(dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(documents, null, 2), "utf8");
  }

  async list(): Promise<GeneratedDocument[]> {
    const documents = await this.readIndex();
    return documents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<GeneratedDocument | undefined> {
    const documents = await this.readIndex();
    return documents.find((doc) => doc.id === id);
  }

  async save(document: GeneratedDocument): Promise<void> {
    const documents = await this.readIndex();
    const existingIndex = documents.findIndex((doc) => doc.id === document.id);
    if (existingIndex >= 0) {
      documents[existingIndex] = document;
    } else {
      documents.push(document);
    }
    await this.writeIndex(documents);
  }
}
