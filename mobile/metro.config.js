const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (moduleName === "react-native-maps") {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "shims/react-native-maps/index.tsx"),
      };
    }
    if (moduleName === "react-native-maps-directions") {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "shims/react-native-maps-directions/index.tsx"),
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
