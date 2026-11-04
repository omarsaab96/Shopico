import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: {
    "react-native": fileURLToPath(new URL("./tests/stubs/react-native.ts", import.meta.url)),
    "expo-secure-store": fileURLToPath(new URL("./tests/stubs/secure-store.ts", import.meta.url)),
    "expo-constants": fileURLToPath(new URL("./tests/stubs/constants.ts", import.meta.url)),
  } },
  test: { include: ["tests/**/*.test.ts"] },
});
