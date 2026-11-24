import { computed, ref } from "vue";
import { ipcRouters } from "@/core/IpcRouter";
import { request } from "@/utils/ipcUtils";
import { useTunnelStore } from "@/store/tunnel";

/** One existing proxy whose target is a discovered service. */
export interface DiscoveryMapping {
  proxyId: string;
  proxyName: string;
  proxyType: string;
  tunnelId: string;
  tunnelName: string;
  localIP: string;
  localPort: number;
  enabled: boolean;
}

const normalizeHost = (value: string) =>
  (value || "").trim().toLowerCase().replace(/\.$/, "");

/**
 * Reads proxies of every frpc instance and indexes them by target address and
 * port. A discovered service is "already mapped" only when an existing proxy
 * points at exactly that host and port.
 */
export function useProxyMappings() {
  const tunnels = useTunnelStore();
  const mappings = ref<DiscoveryMapping[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  let pending: Promise<void> | null = null;

  const index = computed(() => {
    const map = new Map<string, DiscoveryMapping[]>();
    for (const mapping of mappings.value) {
      const key = `${normalizeHost(mapping.localIP)}:${mapping.localPort}`;
      const list = map.get(key);
      if (list) list.push(mapping);
      else map.set(key, [mapping]);
    }
    return map;
  });

  const lookup = (address: string, port: number) =>
    index.value.get(`${normalizeHost(address)}:${port}`)?.[0] || null;

  /** How many proxies share this exact target, so the UI can say so. */
  const countAt = (address: string, port: number) =>
    index.value.get(`${normalizeHost(address)}:${port}`)?.length || 0;

  const countFor = (device: DiscoveredDevice) =>
    device.services.filter(service => lookup(service.targetAddress, service.port))
      .length;

  /**
   * A proxy on the same port but another host. Proxy names are user-chosen, so
   * the name is never part of the test; the hint just points at the likely
   * match and the row itself still shows the discovered service name.
   */
  const similar = (address: string, port: number) => {
    const host = normalizeHost(address);
    return (
      mappings.value.find(
        mapping =>
          mapping.localPort === port && normalizeHost(mapping.localIP) !== host
      ) || null
    );
  };

  async function fetchAll() {
    const frpc = tunnels.frpcTunnels;
    const results = await Promise.all(
      frpc.map(async tunnel => {
        try {
          const response = await request<FrpcProxy[]>(
            ipcRouters.PROXY.getAllProxies,
            { tunnelId: tunnel.id }
          );
          if (response.bizCode !== "A1000") return [];
          return (response.data || [])
            .filter(proxy => proxy.localIP && Number(proxy.localPort) > 0)
            .map(proxy => ({
              proxyId: proxy._id,
              proxyName: proxy.name,
              proxyType: proxy.type,
              tunnelId: tunnel.id,
              tunnelName: tunnel.name,
              localIP: proxy.localIP,
              localPort: Number(proxy.localPort),
              enabled: proxy.status === 1
            }));
        } catch {
          return [];
        }
      })
    );
    mappings.value = results.flat();
    loaded.value = true;
  }

  /** Refreshes once per page visit unless `force` is set. */
  async function load(force = false) {
    if (!force && loaded.value) return;
    if (pending) return pending;
    loading.value = true;
    pending = fetchAll().finally(() => {
      pending = null;
      loading.value = false;
    });
    return pending;
  }

  return {
    mappings,
    loading,
    loaded,
    load,
    lookup,
    countAt,
    countFor,
    similar
  };
}
