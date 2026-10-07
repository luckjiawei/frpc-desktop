import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  copyServiceAssets,
  encodedPowerShell,
  psLiteral
} from "../electron/utils/WindowsServiceConfig.ts";
import {
  prepareWindowsService,
  verifySha256,
  verifyWinSW
} from "../scripts/prepare-windows-service.mjs";
import { createHash } from "node:crypto";

test("PowerShell paths remain a single literal and survive UTF-16 encoding", () => {
  const value = "E:\\中文目录\\it's a file; $(Write-Host test).pem";
  const script = `$path = ${psLiteral(value)}`;
  assert.equal(psLiteral(value), `'${value.replaceAll("'", "''")}'`);
  assert.equal(
    Buffer.from(encodedPowerShell(script), "base64").toString("utf16le"),
    script
  );
});

test("certificate snapshots are copied, deduplicated and nested paths are rewritten", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "frpc-service-test-")
  );
  try {
    const certificate = path.join(temporary, "用户证书.pem");
    const key = path.join(temporary, "private key.pem");
    fs.writeFileSync(certificate, "test-certificate");
    fs.writeFileSync(key, "test-key");
    const stage = path.join(temporary, "stage");
    const destination = path.join(temporary, "deployment");
    const config = {
      transport: {
        tls: { certFile: certificate, keyFile: key, trustedCaFile: certificate }
      },
      proxies: [{ plugin: { crtPath: certificate, keyPath: key } }],
      user: certificate,
      auth: { token: "private-token" },
      log: { to: "stdout" }
    };
    copyServiceAssets(config, stage, destination);
    assert.equal(
      config.transport.tls.certFile,
      path.join(destination, "assets", "asset-0.pem")
    );
    assert.equal(
      config.proxies[0].plugin.crtPath,
      config.transport.tls.certFile
    );
    assert.equal(
      config.proxies[0].plugin.keyPath,
      config.transport.tls.keyFile
    );
    assert.equal(config.user, certificate);
    assert.equal(config.auth.token, "private-token");
    assert.equal(fs.readdirSync(path.join(stage, "assets")).length, 2);
    assert.equal(
      fs.readFileSync(path.join(stage, "assets", "asset-0.pem"), "utf8"),
      "test-certificate"
    );
    assert.equal(
      fs.readFileSync(path.join(stage, "assets", "asset-1.pem"), "utf8"),
      "test-key"
    );
    assert.equal(fs.readFileSync(certificate, "utf8"), "test-certificate");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("missing referenced files fail preparation before deployment", () => {
  assert.throws(() =>
    copyServiceAssets(
      { certFile: path.join(os.tmpdir(), "missing-frpc-certificate") },
      os.tmpdir(),
      os.tmpdir()
    )
  );
});

test("empty optional TLS files do not become asset copies", () => {
  const config = {
    transport: { tls: { certFile: "", keyFile: "", trustedCaFile: "" } }
  };
  copyServiceAssets(config, os.tmpdir(), os.tmpdir());
  assert.equal(config.transport.tls.certFile, "");
});

test("relative certificate paths use frpc's working directory", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "frpc-service-relative-")
  );
  try {
    const sourceDirectory = path.join(temporary, "version");
    const stage = path.join(temporary, "stage");
    const destination = path.join(temporary, "deployment");
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(
      path.join(sourceDirectory, "relative.pem"),
      "relative-certificate"
    );
    const config = { transport: { tls: { certFile: "relative.pem" } } };
    copyServiceAssets(config, stage, destination, sourceDirectory);
    assert.equal(
      fs.readFileSync(path.join(stage, "assets", "asset-0.pem"), "utf8"),
      "relative-certificate"
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

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
