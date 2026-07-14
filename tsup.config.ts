import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/storage/memory.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Zero runtime deps — the core runs on web-standard globals (fetch/WebSocket).
  external: [],
});
