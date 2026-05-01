import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import importPlugin from "eslint-plugin-import";

const jsdocStrictRules = {
  "jsdoc/tag-lines": ["error", "any", { startLines: 1 }],
  "jsdoc/check-alignment": "error",
  "jsdoc/no-undefined-types": "off",
  "jsdoc/check-param-names": "error",
  "jsdoc/check-tag-names": "error",
  "jsdoc/check-types": "error",
  "jsdoc/implements-on-classes": "error",
  "jsdoc/require-description": "error",
  "jsdoc/require-jsdoc": [
    "error",
    {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false,
        FunctionExpression: false,
      },
    },
  ],
  "jsdoc/require-param": "error",
  "jsdoc/require-param-description": "error",
  "jsdoc/require-param-type": "off",
  "jsdoc/require-returns": "error",
  "jsdoc/require-returns-description": "error",
  "jsdoc/require-returns-type": "off",
  "jsdoc/require-hyphen-before-param-description": ["error", "always"],
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".next/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: 2020,
      globals: {
        process: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
        Buffer: "readonly",
        console: "readonly",
        exports: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      prettier: prettier,
      jsdoc: jsdoc,
      import: importPlugin,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "import/first": "error",
      "prettier/prettier": "error",
      "@typescript-eslint/member-ordering": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Public API surface — CLAUDE.md mandates JSDoc on all API routes.
    files: ["app/api/**/*.ts"],
    rules: jsdocStrictRules,
  },
  {
    // Tests: signatures + names carry the intent; JSDoc and loose typing would
    // only add noise. Keep unused-vars on with the `_` convention so genuine
    // forgotten variables still surface.
    files: ["**/*.test.ts", "**/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/check-param-names": "off",
      "jsdoc/check-tag-names": "off",
      "jsdoc/check-types": "off",
      "jsdoc/tag-lines": "off",
      "jsdoc/require-hyphen-before-param-description": "off",
    },
  },
];
