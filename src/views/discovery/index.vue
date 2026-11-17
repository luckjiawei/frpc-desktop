<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useTunnelStore } from "@/store/tunnel";
import { useDiscoveryDraftStore } from "@/store/discoveryDraft";
import { useDiscovery } from "@/views/discovery/useDiscovery";

const { t, te, locale } = useI18n();
const router = useRouter();
const tunnels = useTunnelStore();
const drafts = useDiscoveryDraftStore();
const {
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
} = useDiscovery();
const query = ref("");
const source = ref("");
const serviceType = ref("");
const transport = ref("");
const page = ref(1);
const pageSize = 25;
const sources = ["mdns", "ssdp", "neighbor", "tcpProbe"];
const selectedScope = computed(() =>
  scopes.value.find(scope => scope.scopeId === scopeId.value)
);
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
const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t("discovery.unknown")
    : date.toLocaleTimeString(locale.value);
};
const addressText = (address: DiscoveryAddress) =>
  address.zoneId ? `${address.address}%${address.zoneId}` : address.address;
const deviceText = (device: DiscoveredDevice) =>
  [device.name, ...device.addresses.map(addressText)].join(" ").toLowerCase();
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
const filteredDevices = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return (snapshot.value?.devices || []).flatMap(device => {
    const deviceMatches = !needle || deviceText(device).includes(needle);
    const services = device.services.filter(service => {
      return (
        (!transport.value || service.transport === transport.value) &&
        (!source.value || service.sources.includes(source.value)) &&
        (!serviceType.value || service.protocolHint === serviceType.value) &&
        (deviceMatches || serviceText(service).includes(needle))
      );
    });
    const showDevice =
      !transport.value &&
      !serviceType.value &&
      (!source.value || device.sources.includes(source.value)) &&
      deviceMatches;
    return services.length || showDevice ? [{ ...device, services }] : [];
  });
});
const visibleDevices = computed(() =>
  filteredDevices.value.slice(
    (page.value - 1) * pageSize,
    page.value * pageSize
  )
);
watch([query, source, serviceType, transport, scopeId], () => (page.value = 1));
watch(
  () => filteredDevices.value.length,
  count => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize)));
  }
);
const statusType = computed(() => {
  if (snapshot.value?.status === "failed") return "danger";
  if (snapshot.value?.partial || snapshot.value?.status === "timedOut")
    return "warning";
  return "info";
});
const emptyText = computed(() => {
  if (busy.value || running.value) return t("discovery.searching");
  if (error.value || snapshot.value?.status === "failed")
    return t("discovery.failed");
  if (!scopes.value.length) return t("discovery.noScopes");
  if (!scopeId.value) return t("discovery.chooseScope");
  if (query.value || source.value || serviceType.value || transport.value)
    return t("discovery.noMatches");
  return t("discovery.noResults");
});

const dialogVisible = ref(false);
const selectedService = ref<DiscoveredService | null>(null);
const selectedScanId = ref("");
const tunnelId = ref("");
const proxyType = ref("tcp");
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
  if (!service || stale.value || busy.value)
    return t("discovery.creation.stale");
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
function openDraft(service: DiscoveredService) {
  if (disabledReason(service)) return;
  tunnels.refreshTunnels();
  selectedService.value = service;
  selectedScanId.value = snapshot.value?.scanId || "";
  tunnelId.value =
    tunnels.frpcTunnels.find(item => item.id === tunnels.currentTunnelId)?.id ||
    tunnels.frpcTunnels[0]?.id ||
    "";
  proxyType.value = service.transport;
  dialogVisible.value = true;
}
async function createDraft() {
  const service = currentService.value;
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
      name: service.name || `${service.transport}-${service.port}`,
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
</script>

<template>
  <div class="main discovery-page">
    <Breadcrumb>
      <el-button v-if="running || busy" @click="stop">
        {{ t("discovery.stop") }}
      </el-button>
      <el-button
        type="primary"
        :loading="busy"
        :disabled="busy"
        @click="restart(true)"
      >
        {{ t("discovery.restart") }}
      </el-button>
    </Breadcrumb>
    <div class="page-filter-bar">
      <el-input
        v-model="query"
        class="discovery-search"
        clearable
        :aria-label="t('discovery.search')"
        :placeholder="t('discovery.search')"
      />
      <el-select
        :model-value="scopeId"
        class="discovery-scope"
        :disabled="!scopes.length"
        :aria-label="t('discovery.interface')"
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
      <el-select
        v-model="source"
        class="discovery-filter"
        clearable
        :aria-label="t('discovery.sourceFilter')"
        :placeholder="t('discovery.sourceFilter')"
      >
        <el-option
          v-for="item in sources"
          :key="item"
          :value="item"
          :label="displaySource(item)"
        />
      </el-select>
      <el-select
        v-model="serviceType"
        class="discovery-filter"
        clearable
        :aria-label="t('discovery.serviceTypeFilter')"
        :placeholder="t('discovery.serviceTypeFilter')"
      >
        <el-option
          v-for="protocol in [
            ...new Set(
              (snapshot?.devices || []).flatMap(device =>
                device.services
                  .map(service => service.protocolHint)
                  .filter((value): value is string => !!value)
              )
            )
          ]"
          :key="protocol"
          :label="protocol.toUpperCase()"
          :value="protocol"
        />
      </el-select>
      <el-select
        v-model="transport"
        class="discovery-filter"
        clearable
        :aria-label="t('discovery.transportFilter')"
        :placeholder="t('discovery.transportFilter')"
      >
        <el-option label="TCP" value="tcp" />
        <el-option label="UDP" value="udp" />
      </el-select>
    </div>
    <div class="app-container-breadcrumb pr-2 space-y-3">
      <section class="app-panel p-4 space-y-2" aria-live="polite">
        <div class="flex flex-wrap items-center gap-2">
          <el-tag v-if="snapshot" :type="statusType">
            {{ t(`discovery.status.${snapshot.status}`) }}
          </el-tag>
          <span v-if="busy">{{ t("discovery.preparing") }}</span>
          <span v-else-if="snapshot">
            {{ t(`discovery.phase.${snapshot.phase}`) }} ·
            {{ t("discovery.elapsed", { seconds: elapsed }) }}
          </span>
          <span v-if="snapshot" class="secondary-text">
            {{ t("discovery.deviceCount", { count: snapshot.devices.length }) }}
          </span>
        </div>
        <p v-if="selectedScope" class="break-words">
          {{ t("discovery.scope", { name: selectedScope.name }) }} ·
          {{ selectedScope.prefixes.join(", ") }}
        </p>
        <p class="secondary-text">{{ t("discovery.coverage") }}</p>
        <p v-if="snapshot" class="secondary-text">
          {{
            t("discovery.probes", {
              completed: snapshot.budget.probesCompleted,
              started: snapshot.budget.probesStarted,
              addresses: snapshot.budget.candidateAddresses
            })
          }}
        </p>
        <div v-if="snapshot" class="flex flex-wrap gap-2">
          <el-tag
            v-for="outcome in snapshot.sources"
            :key="outcome.source"
            :type="outcome.status === 'unavailable' ? 'warning' : 'info'"
            effect="plain"
          >
            {{ displaySource(outcome.source) }} ·
            {{ t(`discovery.sourceStatus.${outcome.status}`) }}
          </el-tag>
        </div>
        <p
          v-for="outcome in snapshot?.sources.filter(item => item.reason) || []"
          :key="outcome.source"
          class="secondary-text"
        >
          {{ displaySource(outcome.source) }}:
          {{ displayWarning(outcome.reason!) }}
        </p>
      </section>
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
        v-if="stale && snapshot"
        :title="t('discovery.creation.stale')"
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
      <el-alert
        v-for="warning in [...new Set(snapshot?.warnings || [])]"
        :key="warning"
        :title="displayWarning(warning)"
        type="warning"
        :closable="false"
      />
      <div v-if="!visibleDevices.length" class="app-panel p-4">
        <el-empty :description="emptyText">
          <p class="secondary-text">{{ t("discovery.emptyHint") }}</p>
          <el-button
            v-if="query || source || serviceType || transport"
            class="mt-3"
            @click="
              query = '';
              source = '';
              serviceType = '';
              transport = '';
            "
          >
            {{ t("discovery.clearFilters") }}
          </el-button>
        </el-empty>
      </div>
      <template v-else>
        <el-table :data="visibleDevices" row-key="id" border stripe>
          <el-table-column type="expand">
            <template #default="{ row: device }">
              <div class="p-3 space-y-2">
                <p class="break-words">
                  {{ device.addresses.map(addressText).join(", ") }}
                </p>
                <p v-if="device.expired" class="secondary-text">
                  {{ t("discovery.creation.expired") }}
                </p>
                <el-table
                  v-if="device.services.length"
                  :data="device.services"
                  row-key="id"
                  border
                  stripe
                >
                  <el-table-column
                    :label="t('discovery.service')"
                    min-width="160"
                  >
                    <template #default="{ row: service }">
                      <span class="break-words">{{
                        service.name || t("discovery.unnamedService")
                      }}</span>
                      <p v-if="service.protocolHint" class="secondary-text">
                        {{
                          t(
                            service.protocolEvidence === "portHint"
                              ? "discovery.portHint"
                              : "discovery.announcedProtocol",
                            { protocol: service.protocolHint }
                          )
                        }}
                      </p>
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="targetAddress"
                    :label="t('discovery.address')"
                    min-width="160"
                    show-overflow-tooltip
                  />
                  <el-table-column
                    prop="port"
                    :label="t('discovery.port')"
                    min-width="80"
                  />
                  <el-table-column
                    :label="t('discovery.transport')"
                    min-width="95"
                  >
                    <template #default="{ row: service }">{{
                      service.transport.toUpperCase()
                    }}</template>
                  </el-table-column>
                  <el-table-column
                    :label="t('discovery.sourceFilter')"
                    min-width="135"
                  >
                    <template #default="{ row: service }">{{
                      service.sources.map(displaySource).join(", ")
                    }}</template>
                  </el-table-column>
                  <el-table-column
                    :label="t('discovery.verification')"
                    min-width="190"
                  >
                    <template #default="{ row: service }">
                      <el-tag
                        :type="
                          service.verification === 'tcpReachable'
                            ? 'success'
                            : 'info'
                        "
                        effect="plain"
                      >
                        {{
                          t(
                            `discovery.verificationStatus.${service.verification}`
                          )
                        }}
                      </el-tag>
                      <p
                        v-if="service.sources.includes('mdns')"
                        class="secondary-text"
                      >
                        {{ t("discovery.announced") }}
                      </p>
                    </template>
                  </el-table-column>
                  <el-table-column
                    :label="t('discovery.action')"
                    min-width="200"
                    fixed="right"
                  >
                    <template #default="{ row: service }">
                      <el-button
                        type="primary"
                        link
                        :disabled="!!disabledReason(service)"
                        @click="openDraft(service)"
                      >
                        {{ t("discovery.createProxy") }}
                      </el-button>
                      <p v-if="disabledReason(service)" class="secondary-text">
                        {{ disabledReason(service) }}
                      </p>
                    </template>
                  </el-table-column>
                </el-table>
                <p v-else class="secondary-text">
                  {{ t("discovery.noServices") }}
                </p>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('discovery.device')" min-width="180">
            <template #default="{ row }">
              <span class="font-semibold text-primary break-words">{{
                row.name || row.addresses[0]?.address
              }}</span>
              <p class="secondary-text break-words">
                {{ row.addresses.map(addressText).join(", ") }}
              </p>
            </template>
          </el-table-column>
          <el-table-column :label="t('discovery.sourceFilter')" min-width="150">
            <template #default="{ row }">
              {{ row.sources.map(displaySource).join(", ") }}
              <p v-if="row.sources.includes('neighbor')" class="secondary-text">
                {{ t("discovery.neighborHint") }}
              </p>
            </template>
          </el-table-column>
          <el-table-column :label="t('discovery.services')" min-width="95">
            <template #default="{ row }">{{ row.services.length }}</template>
          </el-table-column>
          <el-table-column :label="t('discovery.lastSeen')" min-width="125">
            <template #default="{ row }">{{
              dateText(row.lastSeenAt)
            }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="filteredDevices.length > pageSize"
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filteredDevices.length"
          layout="prev, pager, next"
          :pager-count="5"
          class="py-3"
        />
      </template>
    </div>
    <el-dialog
      v-model="dialogVisible"
      :title="t('discovery.createProxy')"
      width="min(520px, calc(100vw - 32px))"
    >
      <template v-if="selectedService">
        <p class="break-words mb-3">
          {{ selectedService.targetAddress }}:{{ selectedService.port }} ·
          {{ selectedService.transport.toUpperCase() }}
        </p>
        <el-alert
          :title="t('discovery.creation.review')"
          type="info"
          :closable="false"
          class="mb-3"
        />
        <p v-if="currentService" class="secondary-text mb-3">
          {{ t(`discovery.verificationStatus.${currentService.verification}`) }}
          · {{ t("discovery.creation.unverified") }}
        </p>
        <el-alert
          v-if="draftDisabledReason"
          :title="draftDisabledReason"
          type="warning"
          :closable="false"
          class="mb-3"
        />
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
  .discovery-search {
    flex: 1 1 220px;
  }
  .discovery-scope {
    flex: 1 1 240px;
    min-width: 0;
  }
  .discovery-filter {
    flex: 1 1 140px;
  }
  .secondary-text {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .app-container-breadcrumb,
  :deep(.el-dialog__body) {
    user-select: text;
  }
  :deep(.el-tag) {
    height: auto;
    min-height: 24px;
    white-space: normal;
  }
}
</style>
