import fs from "fs";

import { getOpenitiNodes } from "./src/indexer/openiti";

const nodes = await getOpenitiNodes({
  id: "0256Bukhari.Sahih",
  versionId: "0256Bukhari.Sahih.JK000110-ara1",
  overwrite: true,
});

fs.writeFileSync("nodes.json", JSON.stringify(nodes, null, 2));
