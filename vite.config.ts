import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { sofaProxy } from "./dev/sofaProxy";

export default defineConfig({
  plugins: [preact(), sofaProxy()],
  server: { port: 5180 },
});
