import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRealDataset } from "../apps/api/src/lib/build-dataset.js";

const root = process.cwd();
const cleanedDataDir = path.resolve(root, "cleaned_ais_data");
const outputDir = path.resolve(root, "data", "generated");
const voyageOutputDir = path.resolve(outputDir, "voyages");
const outputPath = path.resolve(outputDir, "real-data.json");
const diagnosticsPath = path.resolve(outputDir, "check-animation.json");

async function main() {
  console.log("Building structured AIS dataset from cleaned_ais_data...");
  const dataset = await buildRealDataset(cleanedDataDir);
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
