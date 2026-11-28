import { computed, onMounted, onUnmounted, ref } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipcRouters, listeners } from "@/core/IpcRouter";
import { request } from "@/utils/ipcUtils";

class DiscoveryError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

const isRunning = (snapshot: DiscoverySnapshot | null) =>
  snapshot?.status === "pending" || snapshot?.status === "running";

// randomUUID is unavailable in some non-secure webview contexts.
const requestId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useDiscovery(options: { extraNetworks?: () => string[] } = {}) {
  const scopes = ref<DiscoveryScope[]>([]);
  const scopeId = ref("");
  const snapshot = ref<DiscoverySnapshot | null>(null);
  const busy = ref(false);
  const stale = ref(true);
  const error = ref("");
  const networkChanged = ref(false);
  const now = ref(Date.now());
  let networkVersion = "";
  let active: {
    scanId: string;
    networkVersion: string;
    scopeId: string;
  } | null = null;
  let generation = 0;
  let disposed = false;
  let queue = Promise.resolve();
  let unlisten: UnlistenFn | undefined;
  let ready: Promise<void>;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastUpdate = 0;
  let recoveryAttempts = 0;
  let recoveryPending = false;
  let networkReloads = 0;
  let cancelRequested = false;

  const running = computed(() => isRunning(snapshot.value) && !stale.value);
  const elapsed = computed(() => {
    const value = snapshot.value;
    if (!value) return 0;
    const end = running.value ? now.value : Date.parse(value.updatedAt);
    return Math.max(0, Math.floor((end - Date.parse(value.startedAt)) / 1000));
  });

  async function call<T>(route: IpcRouter, args?: unknown): Promise<T> {
    const response = await request<T>(route, args);
    if (response.bizCode !== "A1000") {
      const data = response.data as { reason?: string } | null;
      throw new DiscoveryError(data?.reason || "unavailable");
    }
    return response.data;
  }

  function reasonOf(cause: unknown) {
    return cause instanceof DiscoveryError ? cause.reason : "unavailable";
  }

  function apply(value: DiscoverySnapshot, token: number) {
    if (
      disposed ||
      token !== generation ||
      !active ||
      value.scanId !== active.scanId ||
      value.networkVersion !== active.networkVersion ||
      value.scopeId !== active.scopeId ||
      (snapshot.value?.scanId === value.scanId &&
        value.revision <= snapshot.value.revision)
    )
      return;
    snapshot.value = value;
    stale.value = false;
    lastUpdate = Date.now();
    if (value.status === "networkChanged") reloadNetwork();
  }

  // The queue includes start itself. A late start response is always stopped
  // before another scope starts, including when the component has unmounted.
  async function stopActive(token: number, preserve = false) {
    if (!active) return;
    const current = active;
    const value = await call<DiscoverySnapshot>(ipcRouters.DISCOVERY.stop, {
      scanId: current.scanId
    });
    if (preserve) apply(value, token);
    if (active === current) active = null;
  }

  function enqueue(work: (token: number) => Promise<void>) {
    const token = ++generation;
    cancelRequested = false;
    busy.value = true;
    error.value = "";
    queue = queue
      .catch(() => undefined)
      .then(async () => {
        if (disposed || token !== generation) return;
        try {
          await work(token);
        } catch (cause) {
          if (!disposed && token === generation) {
            stale.value = true;
            const reason = reasonOf(cause);
            if (reason === "networkChanged") reloadNetwork();
            else {
              error.value = reason;
              // Activation or initial synchronization may fail after a task
              // was created. Release it before reporting a settled error.
              await stopActive(token).catch(() => undefined);
            }
          }
        } finally {
          if (!disposed && token === generation) busy.value = false;
        }
      });
  }

  async function start(token: number) {
    if (disposed || token !== generation || !scopeId.value) return;
    await ready;
    if (disposed || token !== generation || cancelRequested) return;
    const value = await call<DiscoverySnapshot>(ipcRouters.DISCOVERY.start, {
      requestId: requestId(),
      scopeId: scopeId.value,
      networkVersion,
      extraNetworks: options.extraNetworks?.() ?? []
    });
    active = {
      scanId: value.scanId,
      scopeId: value.scopeId,
      networkVersion: value.networkVersion
    };
    if (disposed || token !== generation || cancelRequested) {
      await stopActive(token, cancelRequested && !disposed);
      return;
    }
    recoveryAttempts = 0;
    lastUpdate = Date.now();
    apply(value, token);
    if (disposed || token !== generation || cancelRequested) {
      await stopActive(token, cancelRequested && !disposed);
      return;
    }
    const activated = await call<DiscoverySnapshot>(
      ipcRouters.DISCOVERY.activate,
      { scanId: value.scanId }
    );
    if (disposed || token !== generation || cancelRequested) {
      await stopActive(token, cancelRequested && !disposed);
      return;
    }
    apply(activated, token);
    if (disposed || token !== generation || cancelRequested) {
      await stopActive(token, cancelRequested && !disposed);
      return;
    }
    const current = await call<DiscoverySnapshot>(
      ipcRouters.DISCOVERY.getSnapshot,
      { scanId: value.scanId }
    );
    if (disposed || token !== generation || cancelRequested) {
      await stopActive(token, cancelRequested && !disposed);
      return;
    }
    apply(current, token);
  }

  /** Shows the last finished round immediately; the new scan then refines it. */
  async function restore(token: number) {
    if (snapshot.value || !networkVersion) return;
    try {
      const value = await call<DiscoverySnapshot>(
        ipcRouters.DISCOVERY.getSnapshot,
        { scanId: "" }
      );
      if (disposed || token !== generation || snapshot.value) return;
      if (value.networkVersion !== networkVersion) return;
      snapshot.value = value;
      if (scopes.value.some(scope => scope.scopeId === value.scopeId))
        scopeId.value = value.scopeId;
    } catch {
      // No earlier round to show; the new scan starts from an empty list.
    }
  }

  async function loadScopes(token: number) {
    const value = await call<DiscoveryScopes>(ipcRouters.DISCOVERY.getScopes);
    if (disposed || token !== generation) return;
    scopes.value = value.scopes;
    networkVersion = value.networkVersion;
    // Never automatically choose a virtual interface or an arbitrary network
    // when the backend cannot identify a preferred scope.
    scopeId.value =
      value.scopes.find(s => s.scopeId === scopeId.value)?.scopeId ||
      value.defaultScopeId ||
      "";
    await restore(token);
    await start(token);
  }

  function reloadNetwork() {
    stale.value = true;
    networkChanged.value = true;
    if (networkReloads >= 2) {
      enqueue(async token => {
        await stopActive(token);
        if (!disposed && token === generation) error.value = "networkChanged";
      });
      return;
    }
    networkReloads++;
    enqueue(async token => {
      await stopActive(token);
      if (!disposed && token === generation) await loadScopes(token);
    });
  }

  function restart(reload = false) {
    stale.value = true;
    networkChanged.value = false;
    networkReloads = 0;
    enqueue(async token => {
      await stopActive(token);
      if (disposed || token !== generation) return;
      if (reload || scopes.value.length === 0) await loadScopes(token);
      else await start(token);
    });
  }

  function selectScope(value: string) {
    scopeId.value = value;
    snapshot.value = null;
    restart();
  }

  function stop() {
    const token = generation;
    cancelRequested = true;
    busy.value = true;
    stale.value = true;
    queue = queue
      .catch(() => undefined)
      .then(async () => {
        try {
          await stopActive(token, true);
        } catch (cause) {
          if (!disposed && token === generation) error.value = reasonOf(cause);
        } finally {
          if (!disposed && token === generation) busy.value = false;
        }
      });
  }

  function recover() {
    if (
      disposed ||
      busy.value ||
      recoveryPending ||
      !active ||
      !running.value ||
      Date.now() - lastUpdate < 3000
    )
      return;
    const token = generation;
    const scanId = active.scanId;
    recoveryPending = true;
    call<DiscoverySnapshot>(ipcRouters.DISCOVERY.getSnapshot, { scanId })
      .then(value => {
        apply(value, token);
        if (token === generation) {
          recoveryAttempts = 0;
          lastUpdate = Date.now();
        }
      })
      .catch(() => {
        if (token !== generation) return;
        recoveryAttempts++;
        lastUpdate = Date.now();
        if (recoveryAttempts >= 3) {
          stale.value = true;
          enqueue(async current => {
            await stopActive(current);
            if (!disposed && current === generation)
              error.value = "recoveryFailed";
          });
        }
      })
      .finally(() => {
        recoveryPending = false;
      });
  }

  onMounted(() => {
    ready = listen<ApiResponse<DiscoverySnapshot>>(
      listeners.discoveryUpdated.channel,
      event => {
        // Commands synchronize their own snapshots. Ignore events while a
        // scope transition is pending so old results cannot become fresh.
        if (!busy.value && event.payload.bizCode === "A1000")
          apply(event.payload.data, generation);
      }
    ).then(off => {
      if (disposed) off();
      else unlisten = off;
    });
    // Attach a rejection handler immediately, before scope enumeration resolves.
    ready.catch(() => undefined);
    restart(true);
    timer = setInterval(() => {
      now.value = Date.now();
      recover();
    }, 1000);
  });

  onUnmounted(() => {
    disposed = true;
    generation++;
    if (timer) clearInterval(timer);
    unlisten?.();
    queue = queue
      .catch(() => undefined)
      .then(() => stopActive(generation))
      .catch(() => undefined);
  });

  return {
    scopes,
    scopeId,
    snapshot,
    busy,
    running,
    stale,
    error,
    networkChanged,
    elapsed,
    now,
    restart,
    selectScope,
    stop
  };
}
