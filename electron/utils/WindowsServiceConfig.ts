import fs from "node:fs";
import path from "node:path";

export const WINDOWS_SERVICE_NAME = "FrpcDesktopService";

const FILE_KEYS = new Set([
  "certFile",
  "keyFile",
  "trustedCaFile",
  "crtPath",
  "keyPath"
]);

// Transform the structured config before TOML serialization; range-port Go
// templates must remain intact and cannot be parsed as ordinary TOML.
export function copyServiceAssets(
  config: Record<string, any>,
  stagingDirectory: string,
  deploymentDirectory: string,
  sourceDirectory = process.cwd()
): void {
  const copies = new Map<string, string>();
  const visit = (value: any): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (FILE_KEYS.has(key) && typeof child === "string" && child) {
        const source = path.resolve(sourceDirectory, child);
        if (!fs.statSync(source).isFile()) {
          throw new Error("SERVICE_ASSET_UNREADABLE");
        }
        let filename = copies.get(source);
        if (!filename) {
          filename = `asset-${copies.size}${path.extname(source)}`;
          fs.mkdirSync(path.join(stagingDirectory, "assets"), {
            recursive: true
          });
          fs.copyFileSync(
            source,
            path.join(stagingDirectory, "assets", filename)
          );
          copies.set(source, filename);
        }
        value[key] = path.join(deploymentDirectory, "assets", filename);
      } else {
        visit(child);
      }
    }
  };
  visit(config);
}

export function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function encodedPowerShell(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}
