/** @type {import("prettier").Config} */
const config = {
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  printWidth: 100,
  semi: true,
  singleQuote: false,
  tailwindFunctions: ["cn", "cva"],
  tailwindStylesheet: "./src/styles.css",
  trailingComma: "all",
};

export default config;
