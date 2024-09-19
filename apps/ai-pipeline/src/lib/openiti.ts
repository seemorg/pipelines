import {
  ContentItem,
  parseMarkdown,
  TypedBlock,
} from "@openiti/markdown-parser";

export const getOpenitiBookById = async (id: string, versionId: string) => {
  const [authorId] = id.split(".");
  const baseUrl = `https://raw.githubusercontent.com/OpenITI/RELEASE/2385733573ab800b5aea09bc846b1d864f475476/data/${authorId}/${id}/${versionId}`;
  let response = await fetch(baseUrl);

  if (!response.ok || response.status >= 300) {
    response = await fetch(`${baseUrl}.completed`);

    if (!response.ok || response.status >= 300) {
      response = await fetch(`${baseUrl}.mARkdown`);

      if (!response.ok || response.status >= 300) {
        throw new Error("Book not found");
      }
    }
  }

  const text = await response.text();
  console.log(response.url);

  const final = parseMarkdown(text);

  return final;
};

export const getPageText = (page: ContentItem) => {
  return page.blocks
    .map((block) => {
      if (typeof block.content === "string") {
        return block.content;
      }

      if (typeof block.content === "number") {
        return block.content.toString();
      }

      if (Array.isArray(block.content)) {
        return block.content.join("  ");
      }
    })
    .join(" ");
};

export const getPageHeadings = (page: ContentItem) => {
  return page.blocks.filter(
    (block) => block.type === "header",
  ) as TypedBlock<"header">[];
};
