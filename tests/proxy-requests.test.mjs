import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { compileScript, parse } from "@vue/compiler-sfc";
import ts from "typescript";
import * as vue from "vue";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/views/proxy/index.vue", import.meta.url), "utf8");
const { descriptor } = parse(source);
const compiledPage = compileScript(descriptor, { id: "proxy-request-test" }).content;

function evaluate(source, dependencies) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: name => {
      if (name in dependencies) return dependencies[name];
      if (name.endsWith(".vue") || name.includes("IconifyIcon")) return {};
      return require(name);
    }
  });
  return module.exports;
}

function mountPage(tunnelId = "a") {
  const pending = [];
  const errors = [];
  const mounted = [];
  const unmounted = [];
  const store = vue.reactive({
    loaded: true,
    currentTunnel: tunnelId ? { id: tunnelId, provider: "frpc" } : null
  });
  const ElMessage = options => errors.push(options.message);
  ElMessage.error = message => errors.push(message);
  const ipc = evaluate(readFileSync(new URL("../src/utils/ipcUtils.ts", import.meta.url), "utf8"), {
    "@tauri-apps/api/core": {
      invoke: (_command, args) => new Promise((resolve, reject) => {
        pending.push({ ...args, resolve, reject });
      })
    },
    "@tauri-apps/api/event": { listen: async () => () => {} },
    "element-plus": { ElMessage }
  });
  const routers = evaluate(readFileSync(new URL("../src/core/IpcRouter.ts", import.meta.url), "utf8"), {});
  const component = evaluate(compiledPage, {
    vue: {
      ...vue,
      onMounted: fn => mounted.push(fn),
      onUnmounted: fn => unmounted.push(fn),
      onActivated: () => {}
    },
    "vue-i18n": { useI18n: () => ({ t: key => key }) },
    "@/store/tunnel": { useTunnelStore: () => store },
    "@/utils/ipcUtils": ipc,
    "@/core/IpcRouter": routers,
    "@vueuse/core": { refDebounced: value => value, useDebounceFn: fn => fn },
    "element-plus": { ElMessage },
    "./commonIp.json": []
  }).default;
  const scope = vue.effectScope();
  const page = scope.run(() => component.setup({}, { expose() {} }));
  mounted.forEach(fn => fn());
  return {
    page, store, pending, errors,
    close() {
      unmounted.forEach(fn => fn());
      scope.stop();
    }
  };
}

const success = data => ({ bizCode: "A1000", data, message: "" });
const listRequests = harness => harness.pending.filter(p => p.path === "proxy/getAllProxies");
const settle = async () => {
  // Drain invoke, response handlers, and Vue's scheduled watchers.
  for (let i = 0; i < 5; i++) await vue.nextTick();
};

for (const staleData of [[], [{ _id: "a-proxy", serverId: "a" }]]) {
  test(`an older ${staleData.length ? "nonempty" : "empty"} response cannot clear the new instance`, async () => {
    const h = mountPage();
    try {
      h.store.currentTunnel = { id: "b", provider: "frpc" };
      await settle();
      const [oldRequest, currentRequest] = listRequests(h);
      currentRequest.resolve(success([{ _id: "b-proxy", serverId: "b" }]));
      await settle();
      oldRequest.resolve(success(staleData));
      await settle();
      assert.equal(h.page.proxys.value[0]?._id, "b-proxy");
    } finally { h.close(); }
  });
}

test("an older response cannot finish the current request's loading state", async () => {
  const h = mountPage();
  try {
    h.store.currentTunnel = { id: "b", provider: "frpc" };
    await settle();
    listRequests(h)[0].resolve(success([]));
    await settle();
    assert.equal(h.page.loading.value.list, 1);
  } finally { h.close(); }
});

test("a failed current request finishes loading and reports the error", async () => {
  const h = mountPage();
  try {
    listRequests(h)[0].resolve({ bizCode: "B1008", data: null, message: "Tunnel not found" });
    await settle();
    assert.equal(h.page.loading.value.list, 0);
    assert.deepEqual(h.errors, ["Tunnel not found"]);
  } finally { h.close(); }
});

test("returning to the same instance still rejects responses from its previous visit", async () => {
  const h = mountPage();
  try {
    h.store.currentTunnel = { id: "b", provider: "frpc" };
    await settle();
    h.store.currentTunnel = { id: "a", provider: "frpc" };
    await settle();
    const requests = listRequests(h);
    requests[2].resolve(success([{ _id: "latest", serverId: "a" }]));
    await settle();
    requests[0].resolve(success([{ _id: "outdated", serverId: "a" }]));
    await settle();
    assert.equal(h.page.proxys.value[0]?._id, "latest");
  } finally { h.close(); }
});

test("an empty instance list sends no proxy or configuration requests", () => {
  const h = mountPage("");
  try {
    assert.equal(h.pending.length, 0);
    assert.equal(h.page.loading.value.list, 0);
  } finally { h.close(); }
});
