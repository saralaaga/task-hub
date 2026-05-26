const { execFileSync } = require("child_process");
const { chmodSync, copyFileSync, mkdirSync } = require("fs");
const { join } = require("path");

const root = process.cwd();
const outDir = join(root, "apple-helper", "build");
const source = join(root, "apple-helper", "TaskHubAppleHelper.swift");
const plist = join(root, "apple-helper", "Info.plist");
const binary = join(outDir, "taskhub-apple-helper");
const pluginBinary = join(root, "taskhub-apple-helper");

mkdirSync(outDir, { recursive: true });

execFileSync(
  "/usr/bin/swiftc",
  [
    "-parse-as-library",
    source,
    "-framework",
    "EventKit",
    "-Xcc",
    "-fmodules-cache-path=/private/tmp/obplugin-clang-module-cache",
    "-module-cache-path",
    "/private/tmp/obplugin-swift-module-cache",
    "-Xlinker",
    "-sectcreate",
    "-Xlinker",
    "__TEXT",
    "-Xlinker",
    "__info_plist",
    "-Xlinker",
    plist,
    "-o",
    binary
  ],
  { stdio: "inherit" }
);

execFileSync("codesign", ["-s", "-", "-f", "-i", "com.taskhub.applehelper", binary], { stdio: "inherit" });

copyFileSync(binary, pluginBinary);
chmodSync(pluginBinary, 0o755);
console.log(`Built ${pluginBinary}`);
