import config from "@webadeva/eslint-config/next";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";

/** @type {import("eslint").Linter.Config[]}*/
export default [
  ...config,
  betterTailwindcss.configs["recommended"],
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // Next.js file-convention exports (pages, layouts, metadata images)
          allowExportNames: [
            "metadata",
            "generateMetadata",
            "viewport",
            "generateViewport",
            "generateStaticParams",
            "dynamic",
            "revalidate",
            "alt",
            "size",
            "contentType",
          ],
        },
      ],
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-unknown-classes": [
        "warn",
        {
          ignore: ["^custom:[A-Za-z0-9]+$"],
        },
      ],
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/styles/globals.css",
        // also lint classes inside tw`...` and tw("...") (see src/utils/tw.ts)
        selectors: [
          ...getDefaultSelectors(),
          { kind: "tag", path: "^tw$" },
          { kind: "callee", path: "^tw$", match: [{ type: "strings" }] },
        ],
      },
    },
  },
];
