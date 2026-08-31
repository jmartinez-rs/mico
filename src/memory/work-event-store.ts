import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Claim,
  Confidence,
  Evidence,
  WorkEvent,
} from "../domain/work-event.js";

/**
 * Registro persistido en la MEMORIA de eventos de trabajo. Guarda el `WorkEvent`
 * y su `Evidence` (Incremento A) junto con los `Claim`, la `Confidence` y la
 * narrativa derivados, de modo que las vistas posteriores (p. ej. el digest
 * semanal, Incremento B) puedan reconstruirse sin volver a consultar GitHub ni
 * el LLM. Es la base de la "memoria trazable del trabajo" del piloto.
 */
export interface StoredWorkEvent {
  workEvent: WorkEvent;
  evidence: Evidence[];
  claims: Claim[];
  confidence: Confidence;
  needsHumanReview: boolean;
  narrative: string;
  /** ISO; momento en que se persistió/actualizó el registro. */
  storedAt: string;
}

/** Filtros opcionales para consultar la memoria. */
export interface WorkEventQuery {
  repository?: string;
  /** ISO inclusive: `occurredAt >= from`. */
  from?: string;
  /** ISO inclusive: `occurredAt <= to`. */
  to?: string;
}

/**
 * Memoria consultable de eventos de trabajo, persistida en un archivo local
 * JSON (coherente con el enfoque del piloto: nada de bases de datos todavía).
 *
 * El dedupe es por `workEvent.id`, que es una clave estable derivada de
 * `repository#prNumber` (`pr-<slug-repo>-<number>`). Procesar el mismo PR dos
 * veces actualiza el registro existente en lugar de duplicarlo (upsert
 * idempotente).
 */
export class WorkEventStore {
  private readonly indexPath: string;

  constructor(basePath: string) {
    this.indexPath = join(basePath, "index.json");
  }

  private async readIndex(): Promise<StoredWorkEvent[]> {
    try {
      const raw = await readFile(this.indexPath, "utf8");
      return JSON.parse(raw) as StoredWorkEvent[];
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

  private async writeIndex(records: StoredWorkEvent[]): Promise<void> {
    await mkdir(dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, JSON.stringify(records, null, 2), "utf8");
  }

  /** Upsert idempotente por `workEvent.id`. */
  async save(record: StoredWorkEvent): Promise<void> {
    const records = await this.readIndex();
    const index = records.findIndex(
      (item) => item.workEvent.id === record.workEvent.id,
    );
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    await this.writeIndex(records);
  }

  /** Lista los eventos, con filtros opcionales; orden por `occurredAt` desc. */
  async list(query: WorkEventQuery = {}): Promise<StoredWorkEvent[]> {
    const records = await this.readIndex();
    return records
      .filter((record) => matchesQuery(record.workEvent, query))
      .sort((a, b) =>
        b.workEvent.occurredAt.localeCompare(a.workEvent.occurredAt),
      );
  }

  async get(id: string): Promise<StoredWorkEvent | undefined> {
    const records = await this.readIndex();
    return records.find((record) => record.workEvent.id === id);
  }
}

function matchesQuery(workEvent: WorkEvent, query: WorkEventQuery): boolean {
  if (query.repository && workEvent.repository !== query.repository) {
    return false;
  }
  if (query.from && workEvent.occurredAt < query.from) {
    return false;
  }
  if (query.to && workEvent.occurredAt > query.to) {
    return false;
  }
  return true;
}
