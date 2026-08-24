import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "storage/memory": "src/storage/memory.ts",
    "storage/file": "src/storage/file.ts",
    machine: "src/machine/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: [],
});
