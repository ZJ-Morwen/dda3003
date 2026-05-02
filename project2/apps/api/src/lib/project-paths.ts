import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function hasProjectMarkers(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "package.json")) &&
    existsSync(path.join(candidate, "apps")) &&
    existsSync(path.join(candidate, "data", "mock"))
  );
}

function resolveProjectRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../../.."),
    path.resolve(moduleDir, "../../../../../../.."),
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../..")
  ];
  const match = candidates.find(hasProjectMarkers);
  if (!match) {
    throw new Error("Unable to locate project root from relative project markers.");
  }
  return match;
}

export const PROJECT_ROOT = resolveProjectRoot();

export function projectPath(...segments: string[]): string {
  return path.join(PROJECT_ROOT, ...segments);
}
