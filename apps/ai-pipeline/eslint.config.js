import baseConfig from "@usul/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**", ".output/**", "src/index.ts"],
  },
  ...baseConfig,
];
