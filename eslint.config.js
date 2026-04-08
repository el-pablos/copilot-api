import config from "@echristian/eslint-config";

export default [
  ...config({
    prettier: {
      plugins: ["prettier-plugin-packagejson"],
      options: {
        endOfLine: "auto",
      },
    },
    ignores: [
      "public/**",
      "pages/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "tests/**",
      "backup-files/**",
      "fixed-files/**",
      "e2e/**",
    ],
  }),
];
