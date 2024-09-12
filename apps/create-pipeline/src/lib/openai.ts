import { AzureOpenAI } from "openai";

import { env } from "../env";

export const openai = new AzureOpenAI({
  endpoint: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com/`,
  deployment: env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiKey: env.AZURE_OPENAI_KEY,
  apiVersion: "2024-08-01-preview",
});
