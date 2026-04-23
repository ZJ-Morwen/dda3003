import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRealDataset } from "../apps/api/src/lib/build-dataset.js";

const root = process.cwd();
const cleanCsvPath = path.resolve(root, "天津青岛正常航线清洗数据.csv");
const rawCsvPath = path.resolve(root, "天津-青岛495个航次AIS.csv");
const outputDir = path.resolve(root, "data", "generated");
const outputPath = path.resolve(outputDir, "real-data.json");
const diagnosticsPath = path.resolve(outputDir, "check-animation.json");

async function main() {
  console.log("Building structured AIS dataset...");
  const dataset = await buildRealDataset(cleanCsvPath, rawCsvPath);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(dataset), "utf8");
  await writeFile(diagnosticsPath, "[]\n", "utf8");
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
