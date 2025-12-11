module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      ["@babel/plugin-proposal-decorators", { legacy: true }],
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
            "@astik/logic": "../../packages/logic/src",
            "@astik/db": "../../packages/db/src",
            "@astik/ui": "../../packages/ui/src",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
