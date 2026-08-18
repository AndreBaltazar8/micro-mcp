import { readFileSync } from "node:fs";

interface PackageManifest {
  version?: unknown;
}

function packageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as PackageManifest;
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("micro-mcp package version is unavailable");
  }
  return manifest.version;
}

export const MICRO_MCP_VERSION = packageVersion();
