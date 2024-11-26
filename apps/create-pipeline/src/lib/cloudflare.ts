import { env } from "@/env";

export const purgeAllCloudflareCache = async () => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_TOKEN}`,
      },
      body: JSON.stringify({
        purge_everything: true,
      }),
    },
  );

  return response.status < 300;
};
