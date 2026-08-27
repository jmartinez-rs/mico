import { describe, expect, it } from "vitest";
import type { PullRequestData } from "../models/index.js";
import { buildDocumentPath, buildMarkdown, slugify } from "./markdown-writer.js";

const pr: PullRequestData = {
  repository: "acme/web",
  number: 123,
  title: "Add login flow",
  body: "Implements login",
  author: "jose",
  state: "open",
  url: "https://github.com/acme/web/pull/123",
  baseBranch: "main",
  headBranch: "feature/login",
  createdAt: "2026-08-18T00:00:00Z",
  mergedAt: null,
  commits: [],
  files: [],
  reviews: [],
};

describe("slugify", () => {
  it("normaliza acentos y caracteres especiales", () => {
    expect(slugify("Configuración de Sesión")).toBe("configuracion-de-sesion");
  });

  it("devuelve un fallback cuando queda vacío", () => {
    expect(slugify("///")).toBe("documento");
  });
});

describe("buildDocumentPath", () => {
  it("usa el número de PR y el slug de la rama", () => {
    const path = buildDocumentPath("./data/docs", pr);
    expect(path).toBe("data/docs/pull-requests/123-feature-login.md");
  });
});

describe("buildMarkdown", () => {
  it("incluye encabezado trazable y el cuerpo generado", () => {
    const md = buildMarkdown(pr, "## Resumen\nContenido");
    expect(md).toContain("# Add login flow");
    expect(md).toContain("[#123](https://github.com/acme/web/pull/123)");
    expect(md).toContain("`acme/web`");
    expect(md).toContain("## Resumen");
  });
});
