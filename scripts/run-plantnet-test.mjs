import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ENDPOINT = "https://my-api.plantnet.org/v2/identify/all";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const loadEnvFile = async () => {
  const envPath = path.join(rootDir, ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .forEach((line) => {
        const index = line.indexOf("=");
        if (index === -1) return;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      });
  } catch (error) {
    throw new Error(`Failed to load .env file at ${envPath}: ${(error).message}`);
  }
};

const normalizeSpeciesKey = (canonicalName, taxonId) => {
  if (taxonId !== undefined && taxonId !== null) {
    const normalized = String(taxonId).trim();
    if (normalized.length > 0) return normalized;
  }
  return canonicalName.trim().toLowerCase();
};

const run = async () => {
  await loadEnvFile();

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    throw new Error("PLANTNET_API_KEY is required in the environment.");
  }

  const imagePath = path.join(rootDir, "tests", "plant.jpg");
  const buffer = await fs.readFile(imagePath);

  const formData = new FormData();
  formData.append("organs", "leaf");
  formData.append("images", new Blob([buffer], { type: "image/jpeg" }), "plant.jpg");

  const url = new URL(DEFAULT_ENDPOINT);
  url.searchParams.set("api-key", apiKey);

  console.log(`Sending PlantNet identification request using ${imagePath}...`);
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PlantNet request failed with status ${response.status}: ${text}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`PlantNet returned error: ${payload.error}`);
  }

  const results = (payload.results ?? [])
    .map((result) => {
      const species = result.species ?? {};
      const canonicalName = species.scientificNameWithoutAuthor || species.scientificName;
      if (!canonicalName) return null;
      const taxonId = species.gbif?.id !== undefined ? String(species.gbif.id) : undefined;
      return {
        canonicalName,
        commonName: species.commonNames?.[0],
        taxonId,
        score: typeof result.score === "number" ? result.score : 0,
        speciesKey: normalizeSpeciesKey(canonicalName, taxonId),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (results.length === 0) {
    console.log("No candidates returned by PlantNet for this image.");
    return;
  }

  console.log("Top PlantNet candidates:");
  results.forEach((candidate, index) => {
    console.log(`${index + 1}. ${candidate.canonicalName} [score=${candidate.score.toFixed(3)}]`);
    if (candidate.commonName) {
      console.log(`   Common name: ${candidate.commonName}`);
    }
    if (candidate.taxonId) {
      console.log(`   Taxon ID: ${candidate.taxonId}`);
    }
    console.log(`   Species key: ${candidate.speciesKey}`);
  });
};

run().catch((error) => {
  console.error("PlantNet test run failed:", error);
  process.exitCode = 1;
});