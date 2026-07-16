import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "storage/memory": "src/storage/memory.ts",
    "storage/file": "src/storage/file.ts",
    runtime: "src/runtime/index.ts",
    models: "src/models/index.ts",
    cli: "scripts/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: [],
});
