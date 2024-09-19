import { env } from "@/env";
import { OpenAI, OpenAIEmbedding } from "llamaindex";

export const createAzureOpenAI = ({
  temperature = 0,
  ...config
}: Partial<OpenAI> = {}) =>
  new OpenAI({
    azure: {
      apiKey: env.AZURE_OPENAI_KEY,
      endpoint: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: env.AZURE_LLM_DEPLOYMENT_NAME,
      // apiVersion: '2024-05-13',
    },
    temperature,
    ...config,
  });

export const createAzureOpenAIEmbeddings = (
  config: Partial<OpenAIEmbedding> = {},
) =>
  new OpenAIEmbedding({
    azure: {
      apiKey: env.AZURE_OPENAI_KEY,
      endpoint: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
      // apiVersion: '1',
    },
    dimensions: 3072,
    ...config,
  });
