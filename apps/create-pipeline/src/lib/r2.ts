import { env } from "@/env";
import { _Object, paginateListObjectsV2, S3 } from "@aws-sdk/client-s3";

const s3 = new S3({
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_KEY,
  },
  region: "auto",
});

export const uploadToR2 = async (
  key: string,
  body: Buffer,
  options: {
    contentType?: string;
  } = {},
) => {
  await s3.putObject({
    Bucket: env.R2_BUCKET,
    Key: key,
    Body: body,
    ...(options.contentType && { ContentType: options.contentType }),
    ACL: "public-read",
  });
};

export const listAllObjects = async (prefix: string) => {
  const allObjects: Array<_Object> = [];

  const paginator = paginateListObjectsV2(
    { client: s3 },
    {
      Bucket: env.R2_BUCKET,
      Prefix: prefix,
    },
  );

  for await (const object of paginator) {
    allObjects.push(...(object.Contents ?? []));
  }

  return allObjects;
};
