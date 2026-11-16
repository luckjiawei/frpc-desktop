import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { compileScript, parse } from "@vue/compiler-sfc";
import ts from "typescript";
import * as vue from "vue";

const require = createRequire(import.meta.url);

function loadTsModule(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require
  });
  return module.exports;
}

const configLink = loadTsModule("../src/utils/configLink.ts");

const { descriptor } = parse(
  readFileSync(
    new URL("../src/views/tunnel/CreateTunnelDrawer.vue", import.meta.url),
    "utf8"
  )
);
const { outputText } = ts.transpileModule(
  compileScript(descriptor, { id: "create-tunnel-test" }).content,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }
);

function mountDialog() {
  const pending = [];
  const errors = [];
  const messages = [];
  const created = [];
  const dependencies = {
    vue: { ...vue, useModel: () => vue.ref(false) },
    "vue-i18n": { useI18n: () => ({ t: key => key }) },
    "element-plus": {
      ElMessage: {
        error: message => errors.push(message),
        success: message => messages.push(message)
      }
    },
    "@/core/IpcRouter": {
      ipcRouters: {
        TUNNEL: {
          create: { path: "tunnel/create" },
          importTomlConfig: { path: "tunnel/importTomlConfig" },
          importLinkConfig: { path: "tunnel/importLinkConfig" }
        }
      }
    },
    "@/utils/ipcUtils": {
      request: (route, args) =>
        new Promise((resolve, reject) => pending.push({ route, args, resolve, reject }))
    },
    "@/utils/configLink": configLink,
    "@/assets/frp.svg": "frp-logo.svg",
    "@/assets/cloudflare.svg": "cloudflare-logo.svg",
    "@/components/IconifyIcon/src/iconifyIconOffline": {}
  };
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: name => {
      if (name in dependencies) return dependencies[name];
      return require(name);
    }
  });
  const scope = vue.effectScope();
  const page = scope.run(() =>
    module.exports.default.setup(
      {},
      { expose() {}, emit: (...args) => created.push(args) }
    )
  );
  page.formRef.value = {
    validate: () => Promise.resolve(true),
    clearValidate() {}
  };
  return { page, pending, errors, messages, created, close: () => scope.stop() };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await vue.nextTick();
};
const success = data => ({ bizCode: "A1000", data, message: "" });
const tunnel = { id: "new-id", name: "New", provider: "frpc", autoStart: false };

for (const [provider, method] of [
  ["frpc", "manual"],
  ["cloudflared", "manual"]
]) {
  test(`${provider} ${method} creation sends one create request and reports the tunnel`, async () => {
    const h = mountDialog();
    try {
      h.page.provider.value = provider;
      h.page.method.value = method;
      h.page.form.name = " New ";
      const submitting = h.page.submit();
      await settle();
      assert.equal(h.pending.length, 1);
      assert.equal(h.pending[0].route.path, "tunnel/create");
      assert.deepEqual(JSON.parse(JSON.stringify(h.pending[0].args)), {
        name: "New",
        provider
      });
      h.pending[0].resolve(success({ ...tunnel, provider }));
      await submitting;
      assert.equal(h.page.visible.value, false);
      assert.equal(h.messages.length, 1);
      assert.deepEqual(JSON.parse(JSON.stringify(h.created)), [
        ["created", { ...tunnel, provider }]
      ]);
      assert.equal(h.page.submitting.value, false);
    } finally {
      h.close();
    }
  });
}

test("TOML import creates from the selected file and keeps the dialog open when canceled", async () => {
  const h = mountDialog();
  try {
    h.page.method.value = "toml";
    h.page.form.name = "Imported";
    const importing = h.page.submit();
    await settle();
    assert.equal(h.pending[0].route.path, "tunnel/importTomlConfig");
    assert.deepEqual(JSON.parse(JSON.stringify(h.pending[0].args)), {
      name: "Imported"
    });
    h.pending[0].resolve(success({ canceled: true }));
    await importing;
    assert.equal(h.page.visible.value, false); // unchanged by the dialog
    assert.equal(h.page.submitting.value, false);
    assert.equal(h.created.length, 0);
    assert.equal(h.errors.length, 0);

    h.page.visible.value = true;
    await settle();
    h.page.method.value = "toml";
    h.page.form.name = "Imported";
    const retry = h.page.submit();
    await settle();
    h.pending[1].resolve(success({ canceled: false, tunnel }));
    await retry;
    assert.equal(h.page.visible.value, false);
    assert.deepEqual(JSON.parse(JSON.stringify(h.created)), [["created", tunnel]]);
  } finally {
    h.close();
  }
});

test("link import decodes the frp:// link and sends the payload", async () => {
  const h = mountDialog();
  try {
    h.page.method.value = "link";
    h.page.form.name = "From link";
    h.page.form.link = `frp://${Buffer.from(
      JSON.stringify({ serverAddr: "frps.example.test", serverPort: 7000 })
    ).toString("base64")}`;
    const importing = h.page.submit();
    await settle();
    assert.equal(h.pending[0].route.path, "tunnel/importLinkConfig");
    assert.equal(h.pending[0].args.name, "From link");
    assert.deepEqual(JSON.parse(h.pending[0].args.payload), {
      serverAddr: "frps.example.test",
      serverPort: 7000
    });
    h.pending[0].resolve(success(tunnel));
    await importing;
    assert.deepEqual(JSON.parse(JSON.stringify(h.created)), [["created", tunnel]]);
    assert.equal(h.messages.length, 1);
  } finally {
    h.close();
  }
});

test("an invalid link reports an error and sends no request", async () => {
  const h = mountDialog();
  try {
    h.page.method.value = "link";
    h.page.form.name = "Bad link";
    h.page.form.link = "not-a-link";
    await h.page.submit();
    assert.equal(h.pending.length, 0);
    assert.equal(h.errors.length, 1);
    assert.equal(h.errors[0], "tunnel.create.linkInvalid");
    assert.equal(h.created.length, 0);
  } finally {
    h.close();
  }
});

test("repeated clicks submit once", async () => {
  const h = mountDialog();
  try {
    h.page.form.name = "Once";
    const first = h.page.submit();
    const second = h.page.submit();
    await settle();
    assert.equal(h.pending.length, 1);
    h.pending[0].resolve(success(tunnel));
    await Promise.all([first, second]);
    assert.deepEqual(JSON.parse(JSON.stringify(h.created)), [["created", tunnel]]);
  } finally {
    h.close();
  }
});

test("a failed create keeps the dialog open and clears loading", async () => {
  const h = mountDialog();
  try {
    h.page.form.name = "Fails";
    const submitting = h.page.submit();
    await settle();
    h.pending[0].resolve({ bizCode: "B1000", data: null, message: "boom" });
    await submitting;
    assert.equal(h.errors.length, 1);
    assert.equal(h.errors[0], "boom");
    assert.equal(h.page.submitting.value, false);
    assert.equal(h.created.length, 0);
  } finally {
    h.close();
  }
});

test("config links round-trip server settings without local TLS paths", () => {
  const server = {
    serverAddr: "frps.example.test",
    serverPort: 7000,
    multiuser: true,
    user: "alice",
    auth: { method: "token", token: "secret" },
    metadatas: { token: "meta" },
    transport: {
      tcpMux: true,
      heartbeatInterval: 30,
      tls: {
        enable: true,
        certFile: "/secret/cert.pem",
        keyFile: "/secret/key.pem",
        trustedCaFile: "/secret/ca.pem",
        serverName: "frps.example.test",
        disableCustomTLSFirstByte: false
      }
    }
  };
  const link = configLink.encodeConfigLink(server);
  assert.match(link, /^frp:\/\//);
  assert.doesNotMatch(link, /cert\.pem|key\.pem|ca\.pem/);
  assert.deepEqual(JSON.parse(JSON.stringify(configLink.decodeConfigLink(link))), {
    ...server,
    transport: {
      ...server.transport,
      tls: {
        ...server.transport.tls,
        certFile: "",
        keyFile: "",
        trustedCaFile: ""
      }
    }
  });
  assert.throws(() => configLink.decodeConfigLink("https://example.test"));
  assert.throws(() => configLink.decodeConfigLink("frp://not-base64"));
});
