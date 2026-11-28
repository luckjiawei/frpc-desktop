<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useTunnelStore } from "@/store/tunnel";
import { useDiscoveryDraftStore } from "@/store/discoveryDraft";
import { useDiscovery } from "@/views/discovery/useDiscovery";
import { useProxyMappings } from "@/views/discovery/useProxyMappings";
import OsIcon from "@/views/discovery/OsIcon.vue";

const { t, te, locale } = useI18n();
const router = useRouter();
const tunnels = useTunnelStore();
const drafts = useDiscoveryDraftStore();

const EXTRA_NETWORKS_KEY = "discovery.extraNetworks";
const storedExtraNetworks = () => {
  try {
    return localStorage.getItem(EXTRA_NETWORKS_KEY) || "";
  } catch {
    return "";
  }
};
const extraNetworksInput = ref(storedExtraNetworks());
const extraNetworks = () =>
  extraNetworksInput.value
    .split(/[,，\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
    // 支持 192.168.200.* 这种写法，等价于 192.168.200.0/24
    .map(value =>
      /^\d{1,3}(\.\d{1,3}){2}\.\*$/.test(value)
        ? `${value.slice(0, -1)}0/24`
        : value
    );
watch(extraNetworksInput, value => {
  try {
    localStorage.setItem(EXTRA_NETWORKS_KEY, value);
  } catch {
    // localStorage 不可用时仅保留本次会话内的输入
  }
});
const {
  scopes,
  scopeId,
  snapshot,
  busy,
  running,
  stale,
  error,
  networkChanged,
  now,
  restart,
  selectScope,
  stop
} = useDiscovery({ extraNetworks });
/** Applies edited extra ranges on blur instead of requiring a manual refresh. */
function applyExtraNetworks() {
  restart(true);
}
const mappings = useProxyMappings();

const query = ref("");
const onlyUnmapped = ref(false);
const addressFilter = ref<"ipv4" | "ipv6" | null>(null);
const advanced = ref(false);
const openIds = ref<string[]>([]);
const openedOnce = ref(false);

const displaySource = (value: string) =>
  te(`discovery.sources.${value}`)
    ? t(`discovery.sources.${value}`)
    : t("discovery.sources.other");
const displayReason = (value: string) =>
  te(`discovery.reasons.${value}`)
    ? t(`discovery.reasons.${value}`)
    : t("discovery.reasons.unavailable");
const displayWarning = (value: string) =>
  te(`discovery.warnings.${value}`)
    ? t(`discovery.warnings.${value}`)
    : t("discovery.warnings.sourceLimited");
const addressText = (address: DiscoveryAddress) =>
  address.zoneId ? `${address.address}%${address.zoneId}` : address.address;
/** Derived from the literal so a missing `family` field cannot hide a host. */
const familyOf = (value: string): "ipv4" | "ipv6" =>
  value.includes(":") ? "ipv6" : "ipv4";
const addressList = (device: DiscoveredDevice) => {
  const addresses = addressFilter.value
    ? device.addresses.filter(
        address => familyOf(address.address) === addressFilter.value
      )
    : device.addresses;
  return addresses.map(addressText).join(", ");
};

const ipv6Value = (value: string) => {
  const [head, tail] = value.toLowerCase().split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const fill = Math.max(0, 8 - headParts.length - tailParts.length);
  return [...headParts, ...Array<string>(fill).fill("0"), ...tailParts]
    .slice(0, 8)
    .reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part, 16) || 0), 0n);
};
/** Orders IPv4 numerically, then IPv6, so 10.0.0.2 follows 10.0.0.10. */
const ipSortKey = (value: string) => {
  if (value.includes(":")) return (6n << 128n) + ipv6Value(value);
  const parts = value.split(".");
  if (parts.length === 4 && parts.every(part => /^\d+$/.test(part)))
    return (
      (4n << 128n) +
      BigInt(parts.reduce((acc, part) => acc * 256 + Number(part), 0))
    );
  return 9n << 128n;
};
const byAddress = (left: DiscoveredDevice, right: DiscoveredDevice) => {
  const a = ipSortKey(left.addresses[0]?.address || "");
  const b = ipSortKey(right.addresses[0]?.address || "");
  return a < b ? -1 : a > b ? 1 : 0;
};

const relative = (value: string | null | undefined) => {
  if (!value) return "";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  const seconds = Math.max(0, Math.round((now.value - time) / 1000));
  if (seconds < 45) return t("discovery.lan.justNow");
  if (seconds < 3600)
    return t("discovery.lan.minutesAgo", { count: Math.round(seconds / 60) });
  return new Date(time).toLocaleTimeString(locale.value, {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const lookup = (address: string, port: number) =>
  mappings.lookup(address, port);
const similarProxy = (service: DiscoveredService) =>
  lookup(service.targetAddress, service.port)
    ? null
    : mappings.similar(service.targetAddress, service.port);
const proxyCount = (service: DiscoveredService) =>
  mappings.countAt(service.targetAddress, service.port);

interface HostRow {
  device: DiscoveredDevice;
  services: DiscoveredService[];
  /** Ports before the "unmapped only" filter, so header counts stay honest. */
  total: number;
  mappedCount: number;
  unmappedCount: number;
}

const hostText = (device: DiscoveredDevice) =>
  [
    device.name,
    ...device.addresses.map(addressText),
    device.os?.name,
    device.os?.version
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
const serviceText = (service: DiscoveredService) =>
  [
    service.name,
    ...service.instanceNames,
    service.targetAddress,
    service.port,
    service.protocolHint,
    service.transport
  ]
    .join(" ")
    .toLowerCase();

const matchesFamily = (device: DiscoveredDevice) =>
  !addressFilter.value ||
  device.addresses.some(
    address => familyOf(address.address) === addressFilter.value
  );
function toggleFamily(family: "ipv4" | "ipv6") {
  addressFilter.value = addressFilter.value === family ? null : family;
}

const hosts = computed<HostRow[]>(() => {
  const needle = query.value.trim().toLowerCase();
  return (snapshot.value?.devices || [])
    .filter(matchesFamily)
    .sort(byAddress)
    .flatMap(device => {
      const hostMatches = !needle || hostText(device).includes(needle);
      const matched = device.services.filter(
        service =>
          (!addressFilter.value ||
            familyOf(service.targetAddress) === addressFilter.value) &&
          (hostMatches || serviceText(service).includes(needle))
      );
      // A search must hide hosts with no matching name, address or port; only
      // keeping their cards made the search bar look inert.
      if (!hostMatches && matched.length === 0) return [];
      const mappedCount = matched.filter(service =>
        lookup(service.targetAddress, service.port)
      ).length;
      const unmappedCount = matched.length - mappedCount;
      if (onlyUnmapped.value && unmappedCount === 0) return [];
      const services = onlyUnmapped.value
        ? matched.filter(
            service => !lookup(service.targetAddress, service.port)
          )
        : matched;
      return [
        { device, services, total: matched.length, mappedCount, unmappedCount }
      ];
    });
});

const totals = computed(() => {
  const devices = snapshot.value?.devices || [];
  const services = devices.flatMap(device => device.services);
  return {
    hosts: devices.length,
    ports: services.length,
    mapped: services.filter(service =>
      lookup(service.targetAddress, service.port)
    ).length
  };
});
const unmappedTotal = computed(() => totals.value.ports - totals.value.mapped);

watch(
  () => hosts.value.map(host => host.device.id).join("|"),
  ids => {
    if (openedOnce.value || !ids) return;
    openedOnce.value = true;
    openIds.value = ids.split("|").slice(0, 1);
    void mappings.load();
  }
);

watch(
  () => tunnels.frpcTunnels.map(tunnel => tunnel.id).join(","),
  () => void mappings.load(true),
  { immediate: true }
);
onMounted(() => {
  void mappings.load();
  tunnels.refreshTunnels();
});

const isOpen = (device: DiscoveredDevice) => openIds.value.includes(device.id);
function toggle(device: DiscoveredDevice) {
  openIds.value = isOpen(device)
    ? openIds.value.filter(id => id !== device.id)
    : [...openIds.value, device.id];
}

const checking = computed(() => running.value || stale.value);
const statusText = computed(() => {
  if (error.value) return t("discovery.lan.failed");
  if (!scopes.value.length && !snapshot.value) return t("discovery.noScopes");
  if (!snapshot.value) return t("discovery.lan.searching");
  const summary = t("discovery.lan.restored", totals.value);
  return checking.value
    ? `${summary} · ${t("discovery.lan.checking")}`
    : summary;
});
const statusTone = computed(() => {
  if (error.value) return "error";
  if (running.value || stale.value) return "busy";
  return "ok";
});

const osName = (device: DiscoveredDevice) =>
  osKnown(device) ? device.os!.name! : "";
/** Low-confidence guesses are worded as guesses, never as a finding. */
const osText = (device: DiscoveredDevice) => {
  const name = osName(device);
  if (!name) return t("discovery.lan.osUnknown");
  const label =
    device.os?.confidence === "low"
      ? t("discovery.lan.maybeName", { name })
      : name;
  return [label, device.os?.version].filter(Boolean).join(" · ");
};
const confidenceText = (device: DiscoveredDevice) => {
  const confidence = device.os?.confidence;
  if (!confidence) return "";
  return te(`discovery.lan.confidence.${confidence}`)
    ? t(`discovery.lan.confidence.${confidence}`)
    : "";
};
const osKnown = (device: DiscoveredDevice) =>
  !!device.os && device.os.family !== "unknown" && !!device.os.name;

/** Announced mDNS services carry a long instance name; show just the type. */
const serviceLabel = (service: DiscoveredService) =>
  service.protocolEvidence === "announcement" && service.protocolHint
    ? service.protocolHint
    : service.name || "";
const serviceName = (service: DiscoveredService) =>
  serviceLabel(service) || t("discovery.unnamedService");
const hintText = (service: DiscoveredService) => {
  // The name already shows the service type for announcements, so only the
  // transport protocol is left to add.
  if (service.protocolEvidence === "announcement")
    return service.transport.toUpperCase();
  if (service.protocolHint)
    return t("discovery.portHint", { protocol: service.protocolHint });
  return service.transport.toUpperCase();
};

const dialogVisible = ref(false);
const selectedService = ref<DiscoveredService | null>(null);
const selectedScanId = ref("");
const tunnelId = ref("");
const proxyType = ref("tcp");
const draftName = ref("");
const compatibleTypes = (transport: DiscoveryTransport) =>
  transport === "tcp"
    ? ["tcp", "http", "https", "stcp", "xtcp"]
    : ["udp", "sudp"];
const proxyTypes = computed(() =>
  selectedService.value ? compatibleTypes(selectedService.value.transport) : []
);
const submitting = ref(false);
const currentService = computed(() => {
  if (snapshot.value?.scanId !== selectedScanId.value) return null;
  return (
    snapshot.value?.devices
      .flatMap(device => device.services)
      .find(service => service.id === selectedService.value?.id) || null
  );
});
const disabledReason = (service: DiscoveredService | null) => {
  if (!service) return "";
  if (
    service.targetAddress.includes(":") ||
    service.proxyDisabledReason === "ipv6LinkLocal" ||
    service.proxyDisabledReason === "ipv6NotValidated"
  )
    return t("discovery.creation.ipv6");
  if (
    service.expired ||
    service.proxyDisabledReason === "expired" ||
    (service.expiresAt && Date.parse(service.expiresAt) <= now.value)
  )
    return t("discovery.creation.expired");
  if (
    !Number.isInteger(service.port) ||
    service.port < 1 ||
    service.port > 65535 ||
    !["tcp", "udp"].includes(service.transport)
  )
    return t("discovery.draftInvalid");
  return "";
};
const draftDisabledReason = computed(() =>
  disabledReason(currentService.value)
);
function openDraft(service: DiscoveredService, name = "") {
  if (disabledReason(service)) return;
  tunnels.refreshTunnels();
  selectedService.value = service;
  selectedScanId.value = snapshot.value?.scanId || "";
  const mapping = lookup(service.targetAddress, service.port);
  tunnelId.value =
    mapping?.tunnelId ||
    tunnels.frpcTunnels.find(item => item.id === tunnels.currentTunnelId)?.id ||
    tunnels.frpcTunnels[0]?.id ||
    "";
  proxyType.value = service.transport;
  draftName.value =
    name || serviceLabel(service) || `${service.transport}-${service.port}`;
  dialogVisible.value = true;
}
function rebuild(service: DiscoveredService) {
  const mapping = lookup(service.targetAddress, service.port);
  openDraft(service, mapping?.proxyName || "");
}
function openProxy(service: DiscoveredService) {
  const mapping = lookup(service.targetAddress, service.port);
  if (!mapping) {
    openDraft(service);
    return;
  }
  tunnels.setCurrentTunnel(mapping.tunnelId);
  router.push("/proxy");
}
async function createDraft() {
  const service = currentService.value || selectedService.value;
  if (
    !service ||
    draftDisabledReason.value ||
    !tunnels.frpcTunnels.some(item => item.id === tunnelId.value) ||
    !compatibleTypes(service.transport).includes(proxyType.value)
  ) {
    ElMessage.warning(t("discovery.draftInvalid"));
    return;
  }
  if (
    !drafts.setDraft({
      tunnelId: tunnelId.value,
      targetAddress: service.targetAddress,
      port: service.port,
      transport: service.transport,
      name: draftName.value.trim() || `${service.transport}-${service.port}`,
      proxyType: proxyType.value
    })
  ) {
    ElMessage.warning(t("discovery.draftConflict"));
    return;
  }
  submitting.value = true;
  try {
    await router.push("/proxy");
    dialogVisible.value = false;
  } catch {
    drafts.clearDraft();
    ElMessage.error(t("discovery.navigationFailed"));
  } finally {
    submitting.value = false;
  }
}
const currentMapping = computed(() =>
  selectedService.value
    ? lookup(selectedService.value.targetAddress, selectedService.value.port)
    : null
);
</script>

<template>
  <div class="main discovery-page">
    <Breadcrumb>
      <el-button v-if="running || busy" @click="stop">
        {{ t("discovery.stop") }}
      </el-button>
      <el-button
        type="primary"
        :disabled="busy"
        :aria-label="t('discovery.lan.refresh')"
        @click="restart(true)"
      >
        <template #icon>
          <IconifyIconOffline icon="refresh-rounded" />
        </template>
        <span>{{ t("discovery.lan.refresh") }}</span>
      </el-button>
    </Breadcrumb>
    <section class="lan-card app-container-breadcrumb">
      <div class="lan-status" role="status">
        <span class="lan-dot" :class="statusTone" />
        <span>{{ statusText }}</span>
        <time v-if="snapshot">{{
          t("discovery.lan.updatedAt", { time: relative(snapshot.updatedAt) })
        }}</time>
      </div>

      <div class="lan-toolbar">
        <el-input
          v-model="query"
          class="lan-search"
          clearable
          :aria-label="t('discovery.search')"
          :placeholder="t('discovery.lan.searchPlaceholder')"
        >
          <template #prefix>
            <svg class="lan-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
          </template>
        </el-input>
        <button
          class="lan-chip"
          :class="{ active: addressFilter === 'ipv4' }"
          :aria-pressed="addressFilter === 'ipv4'"
          @click="toggleFamily('ipv4')"
        >
          <svg class="lan-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.6 3 2.6 15 0 18" />
            <path d="M12 3c-2.6 3-2.6 15 0 18" />
          </svg>
          <span>{{ t("discovery.lan.onlyIpv4") }}</span>
        </button>
        <button
          class="lan-chip"
          :class="{ active: addressFilter === 'ipv6' }"
          :aria-pressed="addressFilter === 'ipv6'"
          @click="toggleFamily('ipv6')"
        >
          <svg class="lan-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.6 3 2.6 15 0 18" />
            <path d="M12 3c-2.6 3-2.6 15 0 18" />
          </svg>
          <span>{{ t("discovery.lan.onlyIpv6") }}</span>
        </button>
        <button
          class="lan-chip"
          :class="{ active: onlyUnmapped }"
          :aria-pressed="onlyUnmapped"
          @click="onlyUnmapped = !onlyUnmapped"
        >
          <svg class="lan-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 5h18l-7 8v6l-4-2v-4z" />
          </svg>
          <span>{{ t("discovery.lan.onlyUnmapped") }}</span>
          <b>{{ unmappedTotal }}</b>
        </button>
        <button
          class="lan-chip lan-more"
          :class="{ active: advanced }"
          :aria-expanded="advanced"
          aria-controls="discovery-advanced"
          @click="advanced = !advanced"
        >
          <svg class="lan-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" />
            <circle cx="15" cy="6" r="2" />
            <circle cx="9" cy="12" r="2" />
            <circle cx="15" cy="18" r="2" />
          </svg>
          <span>{{ t("discovery.lan.more") }}</span>
        </button>
      </div>

      <div v-if="advanced" id="discovery-advanced" class="lan-advanced">
        <label>
          <span>{{ t("discovery.interface") }}</span>
          <el-select
            :model-value="scopeId"
            :disabled="!scopes.length"
            :placeholder="t('discovery.chooseScope')"
            @change="selectScope"
          >
            <el-option
              v-for="scope in scopes"
              :key="scope.scopeId"
              :value="scope.scopeId"
              :label="`${scope.name} · ${scope.addresses.map(addressText).join(', ')}${scope.isVirtual ? ` (${t('discovery.virtual')})` : ''}`"
            />
          </el-select>
        </label>
        <label class="lan-extra">
          <span>{{ t("discovery.lan.extraNetworks") }}</span>
          <el-input
            v-model="extraNetworksInput"
            clearable
            :placeholder="t('discovery.lan.extraNetworksPlaceholder')"
            @change="applyExtraNetworks"
          />
        </label>
        <p class="lan-hint">{{ t("discovery.lan.extraNetworksHint") }}</p>
        <p class="lan-hint">{{ t("discovery.coverage") }}</p>
        <div v-if="snapshot" class="lan-sources">
          <span
            v-for="outcome in snapshot.sources"
            :key="outcome.source"
            class="lan-source"
            :class="outcome.status"
          >
            {{ displaySource(outcome.source) }} ·
            {{ t(`discovery.sourceStatus.${outcome.status}`) }}
          </span>
        </div>
        <p v-if="snapshot" class="lan-hint">
          {{
            t("discovery.probes", {
              completed: snapshot.budget.probesCompleted,
              started: snapshot.budget.probesStarted,
              addresses: snapshot.budget.candidateAddresses
            })
          }}
        </p>
        <p
          v-for="warning in [...new Set(snapshot?.warnings || [])]"
          :key="warning"
          class="lan-hint"
        >
          {{ displayWarning(warning) }}
        </p>
      </div>

      <el-alert
        v-if="error"
        :title="displayReason(error)"
        type="error"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="networkChanged"
        :title="t('discovery.networkChanged')"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="snapshot?.partial || snapshot?.truncated"
        :title="
          t(snapshot.truncated ? 'discovery.truncated' : 'discovery.partial')
        "
        type="warning"
        show-icon
        :closable="false"
      />

      <div v-if="!hosts.length" class="lan-empty">
        <p class="lan-empty-title">
          {{
            running || busy
              ? t("discovery.searching")
              : query || onlyUnmapped || addressFilter
                ? t("discovery.noMatches")
                : t("discovery.noResults")
          }}
        </p>
        <p class="lan-hint">{{ t("discovery.emptyHint") }}</p>
        <el-button
          v-if="query || onlyUnmapped || addressFilter"
          @click="
            query = '';
            onlyUnmapped = false;
            addressFilter = null;
          "
        >
          {{ t("discovery.clearFilters") }}
        </el-button>
      </div>

      <div v-else class="lan-list">
        <article
          v-for="host in hosts"
          :key="host.device.id"
          class="lan-host"
          :class="{ open: isOpen(host.device) }"
        >
          <button
            class="lan-host-summary"
            :aria-expanded="isOpen(host.device)"
            @click="toggle(host.device)"
          >
            <svg class="lan-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
            <span class="lan-icon-tile">
              <OsIcon
                :family="host.device.os?.family"
                :size="22"
                :label="osText(host.device)"
              />
            </span>
            <span class="lan-host-main">
              <span class="lan-host-title">
                <span class="lan-host-name">{{
                  host.device.name || t("discovery.lan.unnamedHost")
                }}</span>
                <span
                  class="lan-os"
                  :class="host.device.os?.confidence || 'unknown'"
                >
                  {{ osText(host.device) }}
                  <template
                    v-if="osKnown(host.device) && confidenceText(host.device)"
                  >
                    · {{ confidenceText(host.device) }}
                  </template>
                </span>
                <span v-if="host.mappedCount" class="lan-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  {{
                    t("discovery.lan.mappedOf", {
                      mapped: host.mappedCount,
                      total: host.total
                    })
                  }}
                </span>
              </span>
              <span class="lan-host-address">
                {{ addressList(host.device) }}
                <template v-if="host.device.expired">
                  · {{ t("discovery.creation.expired") }}
                </template>
              </span>
            </span>
            <span class="lan-host-labels">
              {{ t("discovery.lan.portCount", { count: host.total }) }}
              <small>{{
                t("discovery.lan.lastSeenAt", {
                  time: relative(host.device.lastSeenAt)
                })
              }}</small>
            </span>
          </button>

          <div v-show="isOpen(host.device)" class="lan-host-body">
            <div
              v-for="service in host.services"
              :key="service.id"
              class="lan-port"
              :class="{ mapped: !!lookup(service.targetAddress, service.port) }"
            >
              <span class="lan-portnum">{{ service.port }}</span>
              <div class="lan-service">
                <div class="lan-service-name">
                  {{ serviceName(service) }}
                  <span class="lan-hint-inline">{{ hintText(service) }}</span>
                  <span
                    v-if="lookup(service.targetAddress, service.port)"
                    class="lan-badge small"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m4 12.5 5 5L20 6.5" />
                    </svg>
                    {{ t("discovery.lan.mapped") }}
                  </span>
                </div>
                <div
                  v-if="lookup(service.targetAddress, service.port)"
                  class="lan-mapped-line"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M9 7H6a5 5 0 0 0 0 10h3M15 7h3a5 5 0 0 1 0 10h-3M8 12h8"
                    />
                  </svg>
                  <span>
                    {{
                      t("discovery.lan.mappedTo", {
                        name: lookup(service.targetAddress, service.port)!
                          .proxyName,
                        tunnel: lookup(service.targetAddress, service.port)!
                          .tunnelName,
                        target: `${lookup(service.targetAddress, service.port)!.localIP}:${lookup(service.targetAddress, service.port)!.localPort}`
                      })
                    }}
                    <template v-if="proxyCount(service) > 1">
                      ·
                      {{
                        t("discovery.lan.moreProxies", {
                          count: proxyCount(service)
                        })
                      }}
                    </template>
                  </span>
                </div>
                <div v-else-if="similarProxy(service)" class="lan-similar">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8h.01M11 12h1v4h1" />
                  </svg>
                  <span>
                    {{
                      t("discovery.lan.maybeSame", {
                        name: similarProxy(service)!.proxyName,
                        target: `${similarProxy(service)!.localIP}:${similarProxy(service)!.localPort}`
                      })
                    }}
                  </span>
                </div>
                <div v-else class="lan-service-hint">
                  {{
                    t(`discovery.verificationStatus.${service.verification}`)
                  }}
                  <template v-if="disabledReason(service)">
                    · {{ disabledReason(service) }}
                  </template>
                </div>
              </div>
              <div class="lan-actions">
                <template v-if="lookup(service.targetAddress, service.port)">
                  <button class="lan-view" @click="openProxy(service)">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 4h6v6M20 4l-8 8" />
                      <path
                        d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
                      />
                    </svg>
                    <span>{{ t("discovery.lan.viewProxy") }}</span>
                  </button>
                  <button
                    class="lan-icon-btn"
                    :title="t('discovery.lan.recreateHint')"
                    :aria-label="t('discovery.lan.recreateHint')"
                    @click="rebuild(service)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                      <path d="M20 5v6h-6" />
                    </svg>
                  </button>
                </template>
                <button
                  v-else
                  class="lan-create"
                  :disabled="!!disabledReason(service)"
                  @click="openDraft(service)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>{{ t("discovery.createProxy") }}</span>
                </button>
              </div>
            </div>
            <p v-if="!host.services.length" class="lan-hint">
              {{ t("discovery.noServices") }}
            </p>
          </div>
        </article>
      </div>

      <p class="lan-mapped-note">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 12.5 5 5L20 6.5" />
        </svg>
        <span>{{ t("discovery.lan.mappedNote") }}</span>
      </p>

      <p class="lan-foot-note">{{ t("discovery.lan.osNote") }}</p>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="t('discovery.createProxy')"
      width="min(520px, calc(100vw - 32px))"
    >
      <template v-if="selectedService">
        <p class="lan-dialog-target">
          {{ selectedService.targetAddress }}:{{ selectedService.port }} ·
          {{ selectedService.transport.toUpperCase() }}
          <span v-if="currentMapping" class="lan-badge small">
            {{ t("discovery.lan.mapped") }}
          </span>
        </p>
        <el-alert
          :title="t('discovery.creation.review')"
          type="info"
          :closable="false"
          class="mb-3"
        />
        <p v-if="draftDisabledReason" class="lan-hint">
          {{ draftDisabledReason }}
        </p>
        <el-empty
          v-if="!tunnels.frpcTunnels.length"
          :description="t('tunnel.noFrpc')"
        >
          <el-button type="primary" @click="router.push('/tunnel')">{{
            t("discovery.createInstance")
          }}</el-button>
        </el-empty>
        <el-form v-else label-position="top">
          <el-form-item :label="t('discovery.instance')" required>
            <el-select v-model="tunnelId" class="w-full">
              <el-option
                v-for="tunnel in tunnels.frpcTunnels"
                :key="tunnel.id"
                :label="tunnel.name"
                :value="tunnel.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('discovery.proxyType')" required>
            <el-select v-model="proxyType" class="w-full">
              <el-option
                v-for="type in proxyTypes"
                :key="type"
                :label="type.toUpperCase()"
                :value="type"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="dialogVisible = false">{{
          t("common.cancel")
        }}</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="
            !!draftDisabledReason ||
            !tunnels.frpcTunnels.some(item => item.id === tunnelId)
          "
          @click="createDraft"
          >{{ t("discovery.continue") }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.discovery-page {
  :deep(.el-input__prefix) {
    display: flex;
    align-items: center;
  }
  .lan-inline-icon {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: var(--el-text-color-placeholder);
    stroke-width: 1.8;
    stroke-linecap: round;
  }
}
.lan-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 26px 26px 18px;
}
.lan-status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  time {
    margin-left: auto;
    font-size: 11px;
  }
}
.lan-create {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--el-color-primary);
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 7px;
  padding: 8px 15px;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
.lan-create {
  border: 0;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 6px 9px;
  font-size: 12px;
  &.is-disabled,
  &:disabled {
    color: var(--el-text-color-disabled);
    background: var(--el-fill-color-light);
  }
}
.lan-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-success);
  &.busy {
    background: var(--el-color-warning);
  }
  &.error {
    background: var(--el-color-danger);
  }
}
.lan-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.lan-search {
  flex: 1 1 auto;
  min-width: 0;
}
.lan-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  border-radius: 20px;
  padding: 6px 11px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  b {
    font-variant-numeric: tabular-nums;
  }
  &.active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary);
    font-weight: 600;
  }
  svg {
    stroke: currentColor;
  }
}
.lan-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  overflow: hidden;
}
.lan-host + .lan-host {
  border-top: 1px solid var(--el-border-color-lighter);
}
.lan-host-summary {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 14px 15px;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.lan-chevron {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  fill: none;
  stroke: var(--el-text-color-placeholder);
  stroke-width: 2;
  stroke-linecap: round;
  transition: transform 0.15s;
}
.lan-host.open .lan-chevron {
  transform: rotate(90deg);
}
.lan-icon-tile {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  flex: 0 0 auto;
}
.lan-host-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.lan-host-title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 650;
}
.lan-host-name {
  overflow-wrap: anywhere;
}
.lan-os {
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  &.high {
    color: var(--el-color-success);
    border-color: var(--el-color-success-light-5);
  }
  &.medium {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning-light-5);
  }
}
.lan-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 650;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-7);
  white-space: nowrap;
  &.small {
    font-size: 10px;
    font-weight: 600;
  }
  svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
.lan-host-address {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.lan-host-labels {
  margin-left: auto;
  text-align: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  small {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}
.lan-host-body {
  padding: 0 16px 12px 62px;
}
.lan-port {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  &.mapped {
    background: var(--el-color-success-light-9);
    border-radius: 6px;
    padding-left: 6px;
    padding-right: 6px;
  }
}
.lan-portnum {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.lan-service {
  min-width: 0;
}
.lan-service-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.lan-hint-inline {
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.lan-service-hint,
.lan-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin: 2px 0 0;
}
.lan-mapped-line {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--el-color-success);
  svg {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    margin-top: 2px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
}
.lan-similar {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--el-color-warning-dark-2);
  svg {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    margin-top: 2px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
}
.lan-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lan-view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--el-color-success-light-5);
  background: var(--el-bg-color);
  color: var(--el-color-success);
  border-radius: 5px;
  padding: 6px 9px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
}
.lan-icon-btn {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
}
.lan-empty {
  border: 1px dashed var(--el-border-color);
  border-radius: 9px;
  padding: 32px 20px;
  text-align: center;
}
.lan-empty-title {
  margin: 0 0 6px;
  font-weight: 600;
}
.lan-mapped-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  svg {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    fill: none;
    stroke: var(--el-color-success);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
}
.lan-more {
  margin-left: auto;
}
.lan-advanced {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 7px;
  font-size: 12px;
  label {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .lan-extra .el-input {
    flex: 1 1 220px;
    min-width: 0;
  }
}
.lan-foot-note {
  margin: 10px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.lan-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}
.lan-source {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  &.unavailable {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning-light-5);
  }
}
.lan-dialog-target {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
@media (max-width: 640px) {
  .lan-card {
    padding: 20px 14px 14px;
  }
  .lan-host-body {
    padding-left: 14px;
  }
  .lan-port {
    grid-template-columns: 44px minmax(0, 1fr);
    row-gap: 6px;
  }
  .lan-actions {
    grid-column: 2;
  }
  .lan-icon-btn {
    display: none;
  }
  .lan-host-labels {
    display: none;
  }
}
</style>
