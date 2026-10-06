import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const WINSW_VERSION = "2.12.0";
export const WINSW_SHA256 = "b5066b7bbdfba1293e5d15cda3caaea88fbeab35bd5b38c41c913d492aadfc4f";
const directory = fileURLToPath(new URL("../resources/windows-service/", import.meta.url));
const filename = "WinSW.NET461.exe";

export function verifyWinSW(buffer) {
  return createHash("sha256").update(buffer).digest("hex") === WINSW_SHA256;
}

export async function prepareWindowsService() {
  const target = path.join(directory, filename);
  try {
    if (verifyWinSW(await fs.readFile(target))) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const url = process.env.WINSW_DOWNLOAD_URL ||
    `https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/${filename}`;
  if (new URL(url).protocol !== "https:") throw new Error("WinSW download requires HTTPS");
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`WinSW download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!verifyWinSW(buffer)) throw new Error("WinSW SHA-256 mismatch");
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, buffer, { flag: "wx" });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepareWindowsService();
  console.log(`WinSW ${WINSW_VERSION}: SHA-256 verified`);
}
