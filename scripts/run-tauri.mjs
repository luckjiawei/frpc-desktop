import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const cargoBin = join(homedir(), ".cargo", "bin");
const sep = process.platform === "win32" ? ";" : ":";
const env = {
  ...process.env,
  PATH: `${cargoBin}${sep}${process.env.PATH || ""}`
};

const args = process.argv.slice(2);
const cmd = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(cmd, ["tauri", ...args], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32"
});

child.on("exit", code => {
  process.exit(code ?? 0);
});
