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
    languageOptions: {
      globals: {
        // Browser globals
        console: "readonly",
        localStorage: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        // Type definitions from global.d.ts
        OpenSourceFrpcDesktopServer: "readonly",
        FrpcVersion: "readonly",
        GitHubMirror: "readonly",
        FrpcProxy: "readonly",
        LocalPort: "readonly",
        FrpConfig: "readonly",
        Proxy: "readonly",
        FrpVersion: "readonly"
      }
    }
  },
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
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      // Vue 规则
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/no-setup-props-destructure": "off",
      "vue/require-prop-types": "off",
      "vue/attributes-order": "off",
      "vue/component-definition-name-casing": "off",
      "vue/attribute-hyphenation": "off",
      "vue/require-toggle-inside-transition": "off",

      // 通用规则
      "no-console": "off",
      "no-debugger": "warn",
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-useless-escape": "warn",
      "no-async-promise-executor": "warn",
      "prefer-const": "warn",
      "prefer-rest-params": "warn"
    }
  },
  prettier
);

