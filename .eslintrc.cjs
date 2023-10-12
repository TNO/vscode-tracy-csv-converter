/* eslint-env node */
module.exports = {
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    rules: {
        "no-useless-escape": "off",
        "no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/naming-convention": [
          "error",
          {
            "selector": ["variable", "parameter"],
            "format": ["camelCase","UPPER_CASE"],
            "leadingUnderscore": "allow"
          }
        ],
        "@typescript-eslint/ban-ts-comment": "warn",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            "argsIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "caughtErrorsIgnorePattern": "^_"
          }
        ]
      }
}
