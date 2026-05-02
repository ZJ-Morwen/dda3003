import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRealDataset } from "../apps/api/src/lib/build-dataset.js";
import { PROJECT_ROOT, projectPath } from "../apps/api/src/lib/project-paths.js";

const outputDir = projectPath("data", "generated");
const voyageOutputDir = path.resolve(outputDir, "voyages");
const outputPath = path.resolve(outputDir, "real-data.json");
const diagnosticsPath = path.resolve(outputDir, "check-animation.json");

async function countCsvFiles(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .length;
  } catch {
    return 0;
  }
}

async function resolveAisCsvDir(): Promise<string> {
  const rootCsvCount = await countCsvFiles(PROJECT_ROOT);
  if (rootCsvCount > 0) {
    return PROJECT_ROOT;
  }
  const cleanedDataDir = projectPath("cleaned_ais_data");
  const cleanedCsvCount = await countCsvFiles(cleanedDataDir);
  if (cleanedCsvCount > 0) {
    return cleanedDataDir;
  }
  throw new Error("No AIS CSV files found in project root or cleaned_ais_data.");
}

async function main() {
  const aisCsvDir = await resolveAisCsvDir();
  const relativeCsvDir = path.relative(PROJECT_ROOT, aisCsvDir) || ".";
  console.log(`Building structured AIS dataset from ${relativeCsvDir}...`);
  const dataset = await buildRealDataset(aisCsvDir);
  await mkdir(outputDir, { recursive: true });
  await mkdir(voyageOutputDir, { recursive: true });

  for (const voyage of dataset.voyages) {
    const voyagePath = path.resolve(voyageOutputDir, `${voyage.voyageId}.json`);
    await writeFile(voyagePath, JSON.stringify(voyage), "utf8");
  }

  const summary = {
    ...dataset,
    voyages: dataset.voyages.map(({ actualRoute, referenceRoute, series, ...voyage }) => voyage)
  };

  await writeFile(outputPath, JSON.stringify(summary), "utf8");
  await writeFile(diagnosticsPath, "[]\n", "utf8");
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
