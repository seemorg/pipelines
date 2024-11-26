import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  isServer: true,
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AZURE_OPENAI_DEPLOYMENT_NAME: z.string(),
    AZURE_OPENAI_KEY: z.string(),
    AZURE_OPENAI_RESOURCE_NAME: z.string(),
    REDIS_URL: z.string(),
    DASHBOARD_USERNAME: z.string(),
    DASHBOARD_PASSWORD: z.string(),
    REPLICATE_API_TOKEN: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_KEY: z.string().min(1),
    R2_ENDPOINT: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    USUL_PIPELINE_API_KEY: z.string().min(1),
    TYPESENSE_URL: z.string().min(1),
    TYPESENSE_API_KEY: z.string().min(1),
    CF_ZONE_ID: z.string().min(1),
    CF_TOKEN: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
