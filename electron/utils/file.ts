import { createHash } from "crypto";

export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024; // 1 KB = 1024 Bytes
  const dm = decimals < 0 ? 0 : decimals; // Ensure decimal places are not less than 0
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k)); // Calculate unit index
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]; // Return formatted string
};

export const calculateFileChecksum = (filePath: string): string => {
  const fs = require("fs");
  const fileBuffer = fs.readFileSync(filePath);
  const hash = createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
};
