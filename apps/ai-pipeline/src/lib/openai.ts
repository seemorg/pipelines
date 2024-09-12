import { env } from "@/env";
import { OpenAI, OpenAIEmbedding } from "llamaindex";

export const createAzureOpenAI = ({
  temperature = 0,
  ...config
}: Partial<OpenAI> = {}) =>
  new OpenAI({
    apiKey: "",
    azure: {
      apiKey: env.AZURE_OPENAI_KEY,
      endpoint: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
      // apiVersion: '2024-05-13',
    },
    model: "gpt-4o",
    temperature,
    ...config,
  });

export const createAzureOpenAIEmbeddings = (
  config: Partial<OpenAIEmbedding> = {},
) =>
  new OpenAIEmbedding({
    apiKey: "",
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
      // apiVersion: '1',
    },
    model: "text-embedding-3-large",
    ...config,
  });
