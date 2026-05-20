import esbuild from "esbuild";
import process from "process";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { builtinModules } from "module";

const prod = process.argv[2] === "production";
const appleHelperPath = "taskhub-apple-helper";
const appleHelperBytes = existsSync(appleHelperPath) ? readFileSync(appleHelperPath) : undefined;
const appleHelperBase64 = appleHelperBytes ? appleHelperBytes.toString("base64") : "";
const appleHelperSha256 = appleHelperBytes ? createHash("sha256").update(appleHelperBytes).digest("hex") : "";

const context = await esbuild.context({
  banner: { js: "/* Obsidian Task Hub */" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`)
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  define: {
    TASKHUB_APPLE_HELPER_BASE64: JSON.stringify(appleHelperBase64),
    TASKHUB_APPLE_HELPER_SHA256: JSON.stringify(appleHelperSha256)
  },
  outfile: "main.js",
  minify: prod
});

if (prod) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
