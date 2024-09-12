import { Settings } from "llamaindex";

import { createAzureOpenAI, createAzureOpenAIEmbeddings } from "./openai";

export const setLlamaIndexSettings = () => {
  Settings.chunkSize = 512;
  Settings.chunkOverlap = 20;

  Settings.llm = createAzureOpenAI();
  Settings.embedModel = createAzureOpenAIEmbeddings({
    embedBatchSize: 30,
  });
};
