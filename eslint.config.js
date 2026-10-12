const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "logs/**", "coverage/**"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser, L: "readonly" },
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "multi-line"],
      "no-eval": "error",
    },
  },
];
