// import { env } from "@/env";

// export const purgeCloudflareCacheByUrl = async (url: string) => {
//   const response = await fetch(
//     `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${env.CF_TOKEN}`,
//       },
//       body: JSON.stringify({
//         files: [url],
//       }),
//     },
//   );
// };
