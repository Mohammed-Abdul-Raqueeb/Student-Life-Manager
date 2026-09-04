import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma rewrites this on every generate; it is not ours to lint.
    "src/generated/**",
  ]),

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          // `const { dueDate: _d, ...rest } = values` is how a field gets
          // dropped before the rest is written to the database. The named keys
          // exist only to exclude themselves from the rest element, so an
          // "unused" warning on them is noise.
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
