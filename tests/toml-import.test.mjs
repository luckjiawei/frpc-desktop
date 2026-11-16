import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { compileScript, parse } from "@vue/compiler-sfc";
import ts from "typescript";
import * as vue from "vue";

const require = createRequire(import.meta.url);
const { descriptor } = parse(readFileSync(new URL("../src/views/tunnel/index.vue", import.meta.url), "utf8"));
const { outputText } = ts.transpileModule(compileScript(descriptor, { id: "toml-import-test" }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
});

function mountPage() {
  const pending = [];
  const sent = [];
  const errors = [];
  const messages = [];
  const store = {
    tunnels: [{ id: "1", name: "Existing", provider: "frpc" }],
    currentTunnelId: "1",
    refreshTunnels() { this.refreshCount++; },
    setCurrentTunnel(id) { this.currentTunnelId = id; },
    refreshCount: 0
  };
  let prompt = () => Promise.resolve({ value: " Imported " });
  const dependencies = {
    vue: { ...vue, onMounted() {}, onUnmounted() {} },
    "vue-i18n": { useI18n: () => ({ t: (key, args) => args?.reason ? `${key}: ${args.reason}` : key }) },
    "@/store/tunnel": { useTunnelStore: () => store },
    "@/utils/ipcUtils": {
      on() {},
      send: (...args) => sent.push(args),
      request: (route, args) => new Promise((resolve, reject) => pending.push({ route, args, resolve, reject }))
    },
    "@/core/IpcRouter": { ipcRouters: { TUNNEL: { importTomlConfig: { path: "tunnel/importTomlConfig" } } } },
    "@vueuse/core": { useDebounceFn: fn => fn },
    "element-plus": {
      ElMessage: { error: message => errors.push(message), success: message => messages.push(message) },
      ElMessageBox: { prompt: () => prompt() }
    },
    "@/router": {},
    "./useTunnelStatus": { useTunnelStatus: () => ({}), useBulkLaunch: () => ({}) }
  };
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: name => {
      if (name in dependencies) return dependencies[name];
      if (name.endsWith(".vue")) return {};
      return require(name);
    }
  });
  const scope = vue.effectScope();
  const page = scope.run(() => module.exports.default.setup({}, { expose() {} }));
  return {
    page, store, pending, sent, errors, messages,
    setPrompt: fn => { prompt = fn; },
    close: () => scope.stop()
  };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await vue.nextTick();
};
const success = data => ({ bizCode: "A1000", data, message: "" });

for (const cancel of ["name prompt", "file picker"]) {
  test(`canceling ${cancel} creates no instance and clears loading`, async () => {
    const h = mountPage();
    try {
      if (cancel === "name prompt") h.setPrompt(() => Promise.reject("cancel"));
      const importing = h.page.handleImportConfig();
      await settle();
      if (cancel === "file picker") h.pending[0].resolve(success({ canceled: true }));
      await importing;
      assert.equal(h.page.importing.value, false);
      assert.equal(h.page.configDrawer.visible, false);
      assert.equal(h.store.currentTunnelId, "1");
      assert.equal(h.store.refreshCount, 0);
      assert.equal(h.errors.length, 0);
      assert.equal(h.messages.length, 0);
      assert.equal(h.sent.length, 0);
      if (cancel === "name prompt") assert.equal(h.pending.length, 0);
    } finally { h.close(); }
  });
}

test("successful import selects the new instance, refreshes the list and opens its configuration", async () => {
  const h = mountPage();
  try {
    const importing = h.page.handleImportConfig();
    await settle();
    assert.equal(h.pending[0].route.path, "tunnel/importTomlConfig");
    assert.equal(h.pending[0].args.name, "Imported");
    assert.equal(h.pending[0].args.tunnelId, undefined);
    const tunnel = { id: "new-id", name: "Imported", provider: "frpc", autoStart: false };
    h.pending[0].resolve(success({ canceled: false, tunnel }));
    await importing;
    assert.equal(h.page.configDrawer.tunnel.id, "new-id");
    assert.equal(h.page.configDrawer.visible, true);
    assert.equal(h.store.currentTunnelId, "new-id");
    assert.equal(h.page.importing.value, false);
    assert.equal(h.store.refreshCount, 1);
    assert.equal(h.messages.length, 1);
    assert.equal(h.sent.length, 0); // No separate create, overwrite or relaunch request.
    assert.equal(h.store.tunnels[0].id, "1");
  } finally { h.close(); }
});

test("failed imports keep the current instance unchanged and allow retry", async () => {
  const h = mountPage();
  try {
    const importing = h.page.handleImportConfig();
    await settle();
    h.pending[0].resolve({ bizCode: "B1000", data: null, message: "Invalid TOML at line 2" });
    await importing;
    assert.equal(h.page.configDrawer.visible, false);
    assert.equal(h.page.importing.value, false);
    assert.equal(h.store.currentTunnelId, "1");
    assert.equal(h.store.refreshCount, 0);
    assert.equal(h.errors.length, 1);
    assert.match(h.errors[0], /Invalid TOML at line 2/);
    const retry = h.page.handleImportConfig();
    await settle();
    assert.equal(h.pending.length, 2);
    h.pending[1].resolve(success({ canceled: true }));
    await retry;
    assert.equal(h.page.importing.value, false);
  } finally { h.close(); }
});

test("repeated clicks submit the import once", async () => {
  const h = mountPage();
  try {
    const importing = h.page.handleImportConfig();
    await settle();
    await h.page.handleImportConfig();
    assert.equal(h.pending.length, 1);
    h.pending[0].resolve(success({ canceled: true }));
    await importing;
    assert.equal(h.page.importing.value, false);
  } finally { h.close(); }
});
