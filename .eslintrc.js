module.exports = {
  env: {
    node: true
  },
  extends: "standard",
  rules: {
    semi: ["error", "never"],
    "space-before-function-paren": ["error", "never"],
    "comma-dangle": "off",
  },
  parserOptions: {
    "ecmaVersion": 2018,
  }
}
