#!/usr/bin/env tsx
/**
 * Script to run individual Typesense indexing functions manually
 * 
 * Usage:
 *   pnpm tsx scripts/run-indexer.ts <indexer-name>
 * 
 * Available indexers:
 *   - authors
 *   - books
 *   - genres
 *   - advanced-genres
 *   - regions
 *   - empires
 *   - search
 *   - all (runs all indexers in sequence)
 */

// Load .env file if it exists (before any other imports)
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env");

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    // Skip comments and empty lines
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, ...valueParts] = trimmedLine.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        // Only set if not already set (env vars take precedence)
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = cleanValue;
        }
      }
    }
  });
}

// CRITICAL: Set ALL environment variables IMMEDIATELY before any module evaluation
// This must happen synchronously at the top level to prevent env validation errors

// Set dummy values for ALL required env vars if they're not set
// This prevents the env validation from failing when modules are loaded
// Note: We use valid dummy values that pass validation, but we'll check for real values later
const allRequiredEnvVars: Record<string, string> = {
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
  TYPESENSE_URL: process.env.TYPESENSE_URL || "http://localhost:8108",
  TYPESENSE_API_KEY: process.env.TYPESENSE_API_KEY || "dummy-key",
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || "dummy",
  AZURE_OPENAI_RESOURCE_NAME: process.env.AZURE_OPENAI_RESOURCE_NAME || "dummy",
  AZURE_LLM_DEPLOYMENT_NAME: process.env.AZURE_LLM_DEPLOYMENT_NAME || "dummy",
  AZURE_EMBEDDINGS_DEPLOYMENT_NAME:
    process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME || "dummy",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  DASHBOARD_USERNAME: process.env.DASHBOARD_USERNAME || "dummy",
  DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || "dummy",
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT || "dummy",
  AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY || "dummy",
  AZURE_SEARCH_INDEX: process.env.AZURE_SEARCH_INDEX || "dummy",
  AZURE_KEYWORD_SEARCH_INDEX:
    process.env.AZURE_KEYWORD_SEARCH_INDEX || "dummy",
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || "dummy",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "dummy",
  R2_SECRET_KEY: process.env.R2_SECRET_KEY || "dummy",
  R2_ENDPOINT: process.env.R2_ENDPOINT || "dummy",
  R2_BUCKET: process.env.R2_BUCKET || "dummy",
  USUL_PIPELINE_API_KEY: process.env.USUL_PIPELINE_API_KEY || "dummy",
  CF_ZONE_ID: process.env.CF_ZONE_ID || "dummy",
  CF_TOKEN: process.env.CF_TOKEN || "dummy",
};

// Set env vars synchronously - this must happen before any imports
Object.entries(allRequiredEnvVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// The truly required vars for indexing (will be validated later)
const requiredForIndexing = ["DATABASE_URL", "TYPESENSE_URL", "TYPESENSE_API_KEY"];

// Map of indexer names to their module paths
const indexerModules: Record<string, string> = {
  authors: "@/typesense/index-authors",
  books: "@/typesense/index-books",
  genres: "@/typesense/index-genres",
  "advanced-genres": "@/typesense/index-advanced-genres",
  regions: "@/typesense/index-regions",
  empires: "@/typesense/index-empires",
  search: "@/typesense/index-search",
};

// Map of indexer names to their function names
const indexerFunctions: Record<string, string> = {
  authors: "indexAuthors",
  books: "indexBooks",
  genres: "indexTypesenseGenres",
  "advanced-genres": "indexTypesenseAdvancedGenres",
  regions: "indexTypesenseRegions",
  empires: "indexTypesenseEmpires",
  search: "indexTypesenseSearch",
};

async function main() {
  // Validate required vars are set with real values (not dummy values)
  const dummyValues: Record<string, string> = {
    DATABASE_URL: "postgresql://dummy:dummy@localhost:5432/dummy",
    TYPESENSE_URL: "http://localhost:8108",
    TYPESENSE_API_KEY: "dummy-key",
  };

  const missingVars = requiredForIndexing.filter((key) => {
    const value = process.env[key];
    return !value || value === dummyValues[key];
  });

  if (missingVars.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missingVars.join(", ")}`,
    );
    console.error(
      "\nPlease set these in your environment or .env file:\n",
    );
    missingVars.forEach((key) => {
      console.error(`  ${key}=...`);
    });
    process.exit(1);
  }

  const indexerName = process.argv[2];

  if (!indexerName) {
    console.error("❌ Please specify an indexer name");
    console.error("\nUsage: pnpm tsx scripts/run-indexer.ts <indexer-name>");
    console.error("\nAvailable indexers:");
    Object.keys(indexerModules).forEach((name) => {
      console.error(`  - ${name}`);
    });
    console.error("  - all (runs all indexers in sequence)");
    process.exit(1);
  }

  // Handle "all" case
  if (indexerName === "all") {
    console.log("🚀 Starting indexing for all collections\n");

    // Run all indexers in the same order as the worker
    const allIndexers: Array<keyof typeof indexerModules> = [
      "authors",
      "books",
      "genres",
      "advanced-genres",
      "regions",
      "empires",
      "search",
    ];

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allIndexers.length; i++) {
      const name = allIndexers[i];
      if (!name) continue;

      const modulePath = indexerModules[name];
      const functionName = indexerFunctions[name];

      if (!modulePath || !functionName) {
        console.error(`❌ Skipping ${name}: configuration not found`);
        failCount++;
        continue;
      }

      console.log(`\n[${i + 1}/${allIndexers.length}] Indexing: ${name}`);
      console.log("─".repeat(50));

      try {
        const module = await import(modulePath);
        const indexer = module[functionName] as () => Promise<void>;

        if (!indexer || typeof indexer !== "function") {
          throw new Error(
            `Function ${functionName} not found in module ${modulePath}`,
          );
        }

        await indexer();
        console.log(`✅ Successfully indexed: ${name}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error indexing ${name}:`);
        console.error(error);
        failCount++;
        // Continue with next indexer instead of exiting
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`\n📊 Indexing Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📦 Total: ${allIndexers.length}`);

    if (failCount > 0) {
      process.exit(1);
    }
    return;
  }

  const modulePath = indexerModules[indexerName];
  const functionName = indexerFunctions[indexerName];

  if (!modulePath || !functionName) {
    console.error(`❌ Unknown indexer: ${indexerName}`);
    console.error("\nAvailable indexers:");
    Object.keys(indexerModules).forEach((name) => {
      console.error(`  - ${name}`);
    });
    console.error("  - all (runs all indexers in sequence)");
    process.exit(1);
  }

  console.log(`🚀 Starting indexing for: ${indexerName}\n`);

  try {
    // Dynamically import the module after env vars are set
    const module = await import(modulePath);
    const indexer = module[functionName] as () => Promise<void>;

    if (!indexer || typeof indexer !== "function") {
      throw new Error(
        `Function ${functionName} not found in module ${modulePath}`,
      );
    }

    await indexer();
    console.log(`\n✅ Successfully indexed: ${indexerName}`);
  } catch (error) {
    console.error(`\n❌ Error indexing ${indexerName}:`);
    console.error(error);
    process.exit(1);
  }
}

main();

