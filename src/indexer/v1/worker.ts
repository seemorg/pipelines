import { Document } from "llamaindex";

import { attachMetadataToNodes } from "./metadata";
import { splitter } from "./splitter";
import { JOIN_PAGES_DELIMITER } from "./utils";

export default ({ chapterPages }: { chapterPages: any[] }) => {
  const concatenatedContent = chapterPages
    .map((p) => p.text)
    .join(JOIN_PAGES_DELIMITER);

  const doc = new Document({
    metadata: {},
    text: concatenatedContent,
  });

  const chapterNodes = splitter.getNodesFromDocuments([doc]);
  console.log("Attaching metadata");

  try {
    attachMetadataToNodes(chapterNodes, chapterPages);
  } catch (e) {
    return {
      status: "error",
      reason: "Failed to attach metadata",
      error: e,
    };
  }

  return chapterNodes;
};
