import { fileURLToPath } from "url";
import createJiti from "jiti";

// TODO: uncomment when adding Prisma
// import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    // "@usul/api",
    // "@usul/auth",
    // "@usul/db",
    // "@usul/ui",
    // "@usul/validators",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // TODO: uncomment when adding Prisma
  // webpack: (config, { isServer }) => {
  //   if (isServer) {
  //     config.plugins = [...config.plugins, new PrismaPlugin()];
  //   }

  //   return config;
  // },
};

export default config;
