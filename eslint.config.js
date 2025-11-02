import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import prettier from "eslint-plugin-prettier/recommended";
import ts from "typescript-eslint";

export default ts.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-electron/**",
      "**/node_modules/**",
      "**/release/**",
      "**/*.js",
      "!eslint.config.js",
      "!.prettierrc.js",
      "!postcss.config.js",
      "!tailwind.config.js"
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        ecmaVersion: "latest",
        sourceType: "module"
      }
    }
  },
  {
    rules: {
      // TypeScript 规则
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-require-imports": "off",

      // Vue 规则
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/no-setup-props-destructure": "off",

      // 通用规则
      "no-console": "off",
      "no-debugger": "warn",
      "no-unused-vars": "off",
      "prefer-const": "warn"
    }
  },
  prettier
);

