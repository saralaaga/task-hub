const { copyFileSync, mkdirSync, readFileSync, rmSync } = require("fs");
const { join } = require("path");

const root = process.cwd();
const dist = join(root, "dist");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

copyFileSync(join(root, "main.js"), join(dist, "main.js"));
copyFileSync(join(root, "manifest.json"), join(dist, "manifest.json"));
copyFileSync(join(root, "src", "styles.css"), join(dist, "styles.css"));

console.log(`Prepared Obsidian release assets in dist/ for Task Hub ${manifest.version}.`);
console.log("Upload main.js, manifest.json, and styles.css to the GitHub release.");
console.log("taskhub-apple-helper is intentionally excluded from dist/ because Obsidian only installs the standard release assets.");
