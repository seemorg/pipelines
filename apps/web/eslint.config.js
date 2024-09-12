import baseConfig, { restrictEnvAccess } from "@usul/eslint-config/base";
import nextjsConfig from "@usul/eslint-config/nextjs";
import reactConfig from "@usul/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
