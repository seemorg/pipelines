import { SentenceSplitter, Settings } from "llamaindex";

export const splitter = new SentenceSplitter({
  chunkSize: 512,
  chunkOverlap: 24,
  secondaryChunkingRegex: "[^,.;。？！...]+[,.;。？！!؟...]+",
});

Settings.chunkSize = 512;
Settings.chunkOverlap = 24;
Settings.nodeParser = splitter;
