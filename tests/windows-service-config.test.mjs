import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  prepareWindowsService,
  verifySha256,
  verifyWinSW
} from "../scripts/prepare-windows-service.mjs";

// Snapshot and PowerShell serialization tests live in src-tauri/src/windows_service.
test("service host integrity accepts the pinned WinSW fixture", async () => {
  const fixturePath = path.resolve(
    "resources/windows-service/WinSW.NET461.exe"
  );
  if (!fs.existsSync(fixturePath)) {
    await prepareWindowsService();
  }
  assert.equal(verifyWinSW(fs.readFileSync(fixturePath)), true);
});

test("service host integrity rejects arbitrary or truncated binaries", () => {
  assert.equal(verifyWinSW(Buffer.from("not-a-service-host")), false);
  assert.equal(verifyWinSW(Buffer.alloc(0)), false);
});

test("hash verification accepts a known-good fixture and rejects a mismatch", () => {
  const fixture = Buffer.from("known-good-service-host");
  const digest = createHash("sha256").update(fixture).digest("hex");
  assert.equal(verifySha256(fixture, digest), true);
  assert.equal(verifySha256(fixture, "0".repeat(64)), false);
});
