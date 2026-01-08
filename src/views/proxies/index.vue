<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { defineComponent } from "vue";
import { useProxies } from "./index";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
defineComponent({
  name: "Proxies"
});

const {
  _,
  proxys,
  loading,
  edit,
  editForm,
  editFormRules,
  editFormRef,
  proxyTypes,
  visitorsModels,
  localPorts,
  listPortsVisible,
  frpcConfig,
  hasPlugin,
  defaultForm,
  isTcp,
  isUdp,
  isHttp,
  isHttps,
  isStcp,
  isSudp,
  isXtcp,
  isStcpvisitorsProvider,
  isStcpVisitors,
  handleSubmit,
  handleAddDomain,
  handleDeleteDomain,
  handleAddLocation,
  handleDeleteLocation,
  handleOpenInsert,
  handleOpenUpdate,
  handleDeleteProxy,
  handleResetForm,
  handleReversalUpdate,
  handleLoadLocalPorts,
  handleSelectLocalPort,
  handleCloseLocalPortDialog,
  handleOpenLocalPortDialog,
  handleSelectFile,
  handleProxyTypeChange,
  handleCopyString,
  handleRandomProxyName,
  handleIpFetchSuggestions
} = useProxies();
</script>
<template>
  <!--  <coming-soon />-->
  <div class="main">
    <breadcrumb>
      <el-button type="primary" @click="handleOpenInsert">
        <IconifyIconOffline icon="add" />
      </el-button>
    </breadcrumb>
    <div v-loading="loading.list > 0" class="app-container-breadcrumb">
      <template v-if="proxys && proxys.length > 0">
        <el-row :gutter="15">
          <el-col
            v-for="proxy in proxys"
            :key="proxy.id"
            :lg="8"
            :md="8"
            :sm="12"
            :xl="6"
            :xs="12"
            class="mb-[15px]"
          >
            <div
              class="flex justify-between items-center p-4 w-full h-full bg-white rounded drop-shadow left-border animate__animated"
            >
              <div class="left">
                <div class="flex items-center">
                  <span class="mr-2 font-bold text-primary">{{
                    proxy.name
                  }}</span>
                </div>
                <div class="mb-1">
                  <el-tag size="small">{{ proxy.type }}</el-tag>
                  <el-tag
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitors'
                    "
                    class="ml-2"
                    size="small"
                  >
                    {{ t("proxy.visitors") }}
                  </el-tag>
                  <el-tag
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitorsProvider'
                    "
                    size="small"
                    class="ml-2"
                    >{{ t("proxy.visitorsProvider") }}
                  </el-tag>
                  <el-tag
                    v-if="proxy.status === 0"
                    class="ml-2"
                    type="danger"
                    size="small"
                    >{{ t("common.disabled") }}
                  </el-tag>
                </div>
                <div class="h-[36px]">
                  <!--
                <div
                  class="text-[12px]"
                  v-if="
                    (proxy.type !== 'stcp' &&
                      proxy.type !== 'xtcp' &&
                      proxy.type !== 'sudp') ||
                    proxy.visitorsModel !== 'visitors'
                  "
                >
                  <span>内网地址：</span>
                  <span class="font-bold text-primary">{{
                    proxy.localIP
                  }}</span>
                </div>
                -->
                  <!--
                <div class="text-[12px]" v-if="proxy.type === 'tcp'">
                  <span>外网端口：</span>
                  <span class="font-bold text-primary">{{
                    proxy.remotePort
                  }}</span>
                </div>
                -->
                  <div
                    v-if="
                      (proxy.type !== 'stcp' &&
                        proxy.type !== 'xtcp' &&
                        proxy.type !== 'sudp') ||
                      proxy.visitorsModel !== 'visitors'
                    "
                    class="text-[12px]"
                  >
                    <span>{{ t("proxy.inner") }}：</span>
                    <span class="font-bold text-primary">
                      {{ proxy.localIP }}:{{ proxy.localPort }}
                    </span>
                  </div>

                  <div
                    v-if="proxy.type === 'tcp' || proxy.type === 'udp'"
                    class="text-[12px] cursor-pointer"
                  >
                    <span>{{ t("proxy.mappingAddress") }}：</span>
                    <span
                      class="font-bold underline cursor-pointer text-primary"
                      @click="
                        handleCopyString(
                          `${frpcConfig?.serverAddr}:${proxy.remotePort}`
                        )
                      "
                    >
                      {{ frpcConfig?.serverAddr }}:{{ proxy.remotePort }}
                    </span>
                  </div>
                  <div
                    v-if="
                      (proxy.type === 'http' || proxy.type === 'https') &&
                      proxy.customDomains &&
                      proxy.customDomains.length > 0 &&
                      proxy.customDomains[0]
                    "
                    class="text-[12px]"
                  >
                    <span>{{ t("proxy.mappingAddress") }}：</span>
                    <span
                      class="font-bold underline cursor-pointer text-primary"
                      @click="
                        handleCopyString(
                          `${proxy.type === 'http' ? 'http://' : 'https://'}${
                            proxy.customDomains[0]
                          }`
                        )
                      "
                      >{{ proxy.type === "http" ? "http://" : "https://" }}
                      {{ proxy.customDomains[0] }}</span
                    >
                  </div>
                  <div
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitors'
                    "
                    class="text-[12px]"
                  >
                    <span>{{ t("proxy.visitorsName") }}：</span>
                    <span class="font-bold text-primary">{{
                      proxy.serverName
                    }}</span>
                  </div>
                  <div
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitors'
                    "
                    class="text-[12px]"
                  >
                    <span>{{ t("proxy.mappingAddress") }}：</span>
                    <span
                      class="font-bold underline cursor-pointer text-primary"
                      @click="
                        handleCopyString(`${proxy.bindAddr}:${proxy.bindPort}`)
                      "
                      >{{ proxy.bindAddr }}:{{ proxy.bindPort }}</span
                    >
                  </div>
                  <!--
                <div
                  class="text-[12px]"
                  v-if="
                    (proxy.type === 'stcp' ||
                      proxy.type === 'xtcp' ||
                      proxy.type === 'sudp') &&
                    proxy.visitorsModel === 'visitors'
                  "
                >
                  <span>绑定端口：</span>
                  <span class="font-bold text-primary">{{
                    proxy.bindPort
                  }}</span>
                </div>
                  -->
                </div>
              </div>

              <div class="right">
                <div class="flex flex-col gap-1 items-center">
                  <el-button
                    type="text"
                    size="small"
                    @click="handleOpenUpdate(proxy)"
                  >
                    <template #icon>
                      <IconifyIconOffline icon="edit" />
                    </template>
                    {{ t("common.modify") }}
                  </el-button>
                  <el-dropdown>
                    <el-button type="text" size="small">
                      <template #icon>
                        <IconifyIconOffline icon="more-horiz" />
                      </template>
                      {{ t("common.more") }}
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleReversalUpdate(proxy)">
                          <IconifyIconOffline
                            class="mr-1"
                            :icon="!proxy.status ? 'toggle-on' : 'toggle-off'"
                          />
                          {{
                            proxy.status
                              ? t("common.disable")
                              : t("common.enable")
                          }}
                        </el-dropdown-item>
                        <el-dropdown-item @click="handleDeleteProxy(proxy)">
                          <IconifyIconOffline
                            class="mr-1"
                            icon="delete-rounded"
                          />
                          {{ t("common.delete") }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </template>
      <div
        v-else
        class="flex overflow-hidden justify-center items-center p-2 w-full h-full bg-white rounded drop-shadow-xl"
      >
        <el-empty :description="t('proxy.noProxy')" />
      </div>
    </div>

    <el-drawer
      v-model="edit.visible"
      :title="edit.title"
      direction="rtl"
      size="60%"
      @close="editForm = _.cloneDeep(defaultForm)"
    >
      <!--    <el-dialog-->
      <!--      v-model="edit.visible"-->
      <!--      :title="edit.title"-->
      <!--      class="sm:w-[500px] md:w-[600px] lg:w-[800px]"-->
      <!--      top="5%"-->
      <!--      @close="editForm = defaultForm"-->
      <!--    >-->
      <el-form
        ref="editFormRef"
        v-loading="loading.form"
        label-position="top"
        :model="editForm"
        :rules="editFormRules"
      >
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item
              :label="t('proxy.form.formItem.proxyType.label')"
              prop="type"
            >
              <el-radio-group
                v-model="editForm.type"
                @change="handleProxyTypeChange"
              >
                <el-radio-button
                  v-for="p in proxyTypes"
                  :key="p"
                  :label="p"
                  :value="p"
                />
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <div class="flex justify-between h3">
              <div>{{ t("proxy.form.title.basicConfig") }}</div>
            </div>
          </el-col>
          <template v-if="isStcp || isSudp || isXtcp">
            <el-col :span="12">
              <el-form-item
                :label="`${editForm.type.toUpperCase()} ${t('common.mode')}`"
                prop="visitorsModel"
              >
                <el-radio-group v-model="editForm.visitorsModel">
                  <el-radio
                    v-for="p in visitorsModels"
                    :key="p.value"
                    :label="p.label"
                    :value="p.value"
                  />
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.secretKey.label')"
                prop="secretKey"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >secretKey</span
                            >
                            {{ t("proxy.form.formItem.secretKey.description") }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.secretKey.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.secretKey"
                  type="password"
                  :placeholder="t('proxy.form.formItem.secretKey.placeholder')"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
          </template>
          <el-col :span="24">
            <el-form-item
              :label="t('proxy.form.formItem.name.label')"
              prop="name"
            >
              <div class="flex gap-2 w-full">
                <el-input
                  v-model="editForm.name"
                  class="w-full"
                  :placeholder="t('proxy.form.formItem.name.placeholder')"
                  clearable
                />
                <el-button plain type="primary" @click="handleRandomProxyName">
                  <IconifyIconOffline
                    class="mr-2 cursor-pointer"
                    icon="charger-rounded"
                  />
                  {{ t("proxy.form.button.generateName") }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>
          <template
            v-if="!(isStcp || isXtcp || isSudp) || isStcpvisitorsProvider"
          >
            <el-col :span="isHttp || isHttps ? 12 : isTcp || isUdp ? 24 : 12">
              <el-form-item
                :label="t('proxy.form.formItem.localIP.label')"
                prop="localIP"
              >
                <el-autocomplete
                  v-model="editForm.localIP"
                  :fetch-suggestions="handleIpFetchSuggestions"
                  clearable
                  placeholder="127.0.0.1"
                />
                <!--                <el-input-->
                <!--                  v-model="editForm.localIP"-->
                <!--                  placeholder="127.0.0.1"-->
                <!--                  clearable-->
                <!--                />-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.localPort.label')"
                prop="localPort"
              >
                <div class="flex gap-2 w-full">
                  <el-input-number
                    v-if="isHttp || isHttps"
                    v-model="editForm.localPort"
                    placeholder="8080"
                    class="w-full"
                    :min="0"
                    :max="65535"
                    controls-position="right"
                  />
                  <el-input
                    v-else
                    v-model="editForm.localPort"
                    placeholder="8080"
                  />
                  <el-button
                    plain
                    type="primary"
                    @click="handleOpenLocalPortDialog"
                  >
                    <IconifyIconOffline
                      class="mr-2 cursor-pointer"
                      icon="bring-your-own-ip-rounded"
                    />
                    {{ t("proxy.form.button.localPort") }}
                  </el-button>
                </div>
              </el-form-item>
            </el-col>
          </template>
          <template v-if="isTcp || isUdp">
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.remotePort.label')"
                prop="remotePort"
              >
                <!--                <el-input-number-->
                <!--                  :min="0"-->
                <!--                  :max="65535"-->
                <!--                  placeholder="8080"-->
                <!--                  v-model="editForm.remotePort"-->
                <!--                  controls-position="right"-->
                <!--                />-->
                <el-input
                  v-model="editForm.remotePort"
                  class="w-full"
                  placeholder="8080"
                />
              </el-form-item>
            </el-col>
          </template>
          <template v-if="isHttp || isHttps">
            <el-col :span="24">
              <div class="flex justify-between h3">
                <div>{{ t("proxy.form.title.domainConfig") }}</div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('proxy.form.formItem.subdomain.label')"
                prop="subdomain"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover
                          placement="top"
                          trigger="hover"
                          :width="300"
                        >
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >subdomain</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.subdomain.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.subdomain"
                  class="w-full"
                  placeholder="subdomain"
                />
              </el-form-item>
            </el-col>
          </template>
          <template v-if="isHttp || isHttps">
            <el-col :span="24">
              <el-form-item
                v-for="(d, di) in editForm.customDomains"
                :key="'domain' + di"
                :label="
                  di === 0 ? t('proxy.form.formItem.customDomains.label') : ''
                "
                :prop="`customDomains.${di}`"
                :rules="[
                  // {
                  //   required: true,
                  //   message: `自定义域名不能为空`,
                  //   trigger: 'blur'
                  // },
                  {
                    pattern:
                      /^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/,
                    message: t(
                      'proxy.form.formItem.customDomains.patternMessage'
                    ),
                    trigger: 'blur'
                  }
                ]"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >customDomains</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.customDomains.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.customDomains[di]"
                  class="domain-input"
                  placeholder="domain.com"
                />
                <el-button
                  class="ml-[10px]"
                  type="primary"
                  plain
                  @click="handleAddDomain"
                >
                  <IconifyIconOffline icon="add" />
                </el-button>
                <el-button
                  type="danger"
                  plain
                  :disabled="editForm.customDomains.length === 1"
                  @click="handleDeleteDomain(di)"
                >
                  <IconifyIconOffline icon="delete-rounded" />
                </el-button>
              </el-form-item>
            </el-col>
          </template>

          <template v-if="isHttp || isHttps">
            <el-col :span="24">
              <el-form-item
                v-for="(d, di) in editForm.locations"
                :key="'locations' + di"
                :label="
                  di === 0 ? t('proxy.form.formItem.locations.label') : ''
                "
                :prop="`locations.${di}`"
                :rules="[
                  // {
                  //   required: true,
                  //   message: `自定义域名不能为空`,
                  //   trigger: 'blur'
                  // },
                  // {
                  //   pattern:
                  //     /^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/,
                  //   message: '请输入正确的域名',
                  //   trigger: 'blur'
                  // }
                ]"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >locations</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.locations.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.locations[di]"
                  class="domain-input"
                  placeholder="/api"
                />
                <el-button
                  class="ml-[10px]"
                  type="primary"
                  plain
                  @click="handleAddLocation"
                >
                  <IconifyIconOffline icon="add" />
                </el-button>
                <el-button
                  type="danger"
                  plain
                  :disabled="editForm.locations.length === 1"
                  @click="handleDeleteLocation(di)"
                >
                  <IconifyIconOffline icon="delete-rounded" />
                </el-button>
              </el-form-item>
            </el-col>
          </template>

          <template v-if="isHttp || isHttps">
            <el-col :span="24">
              <div class="flex justify-between h3">
                <div>{{ t("proxy.form.title.otherConfig") }}</div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('proxy.form.formItem.basicAuth.label')"
                prop="basicAuth"
                label-position="left"
              >
                <el-switch
                  v-model="editForm.basicAuth"
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="editForm.basicAuth" :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.httpUser.label')"
                prop="httpUser"
              >
                <el-input
                  v-model="editForm.httpUser"
                  class="w-full"
                  placeholder="httpUser"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="editForm.basicAuth" :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.httpPassword.label')"
                prop="httpPassword"
              >
                <el-input
                  v-model="editForm.httpPassword"
                  type="password"
                  class="w-full"
                  placeholder="httpPassword"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
          </template>
          <template v-if="hasPlugin">
            <el-col v-if="hasPlugin" :span="24">
              <div class="flex justify-between h3">
                <div>{{ t("proxy.form.title.pluginConfig") }}</div>
              </div>
            </el-col>
            <template v-if="isHttps">
              <el-col :span="24">
                <el-form-item
                  label="https2http"
                  prop="https2http"
                  label-position="left"
                  :rules="[
                    {
                      required: true,
                      trigger: 'blur'
                    }
                  ]"
                >
                  <el-switch
                    v-model="editForm.https2http"
                    :active-text="t('common.yes')"
                    inline-prompt
                    :inactive-text="t('common.no')"
                  />
                </el-form-item>
              </el-col>

              <el-col v-if="editForm.https2http" :span="24">
                <el-form-item
                  :label="t('proxy.form.formItem.https2httpCaFile.label')"
                  prop="https2httpCaFile"
                  label-width="180"
                  :rules="[
                    {
                      required: true,
                      message: t(
                        'proxy.form.formItem.https2httpCaFile.requireMessage'
                      ),
                      trigger: 'blur'
                    }
                  ]"
                >
                  <el-input
                    v-model="editForm.https2httpCaFile"
                    class="button-input"
                    :placeholder="
                      t('proxy.form.formItem.https2httpCaFile.placeholder')
                    "
                    readonly
                    @click="handleSelectFile(1, ['crt', 'pem'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(3, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="editForm.https2httpCaFile"
                    class="ml-2"
                    type="danger"
                    @click="editForm.https2httpCaFile = ''"
                    >{{ t("common.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col v-if="editForm.https2http" :span="24">
                <el-form-item
                  :label="t('proxy.form.formItem.https2httpKeyFile.label')"
                  prop="https2httpKeyFile"
                  label-width="180"
                  :rules="[
                    {
                      required: true,
                      message: t(
                        'proxy.form.formItem.https2httpKeyFile.requireMessage'
                      ),
                      trigger: 'blur'
                    }
                  ]"
                >
                  <el-input
                    v-model="editForm.https2httpKeyFile"
                    class="cursor-pointer button-input"
                    :placeholder="
                      t('proxy.form.formItem.https2httpKeyFile.placeholder')
                    "
                    readonly
                    @click="handleSelectFile(2, ['key'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(3, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="editForm.https2httpKeyFile"
                    class="ml-2"
                    type="danger"
                    @click="editForm.https2httpKeyFile = ''"
                    >{{ t("common.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
            </template>
          </template>
          <template v-if="isStcpVisitors">
            <el-col :span="24">
              <el-form-item
                :label="t('proxy.form.formItem.serverName.label')"
                prop="serverName"
              >
                <el-input
                  v-model="editForm.serverName"
                  type="text"
                  :placeholder="t('proxy.form.formItem.serverName.placeholder')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.bindAddr.label')"
                prop="bindAddr"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >bindAddr</span
                            >
                            <div
                              v-html="
                                t('proxy.form.formItem.bindAddr.description')
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.bindAddr.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.bindAddr"
                  type="text"
                  placeholder="127.0.0.1"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.bindPort.label')"
                prop="bindPort"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >bindAddr</span
                            >
                            <div
                              v-html="
                                t('proxy.form.formItem.bindPort.description')
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.bindPort.label") }}：
                    </div>
                  </div>
                </template>
                <el-input-number
                  v-model="editForm.bindPort"
                  class="w-full"
                  :min="-1"
                  :step="1"
                  controls-position="right"
                  placeholder="8080"
                />
              </el-form-item>
            </el-col>
          </template>
          <template v-if="isXtcp && isStcpVisitors">
            <el-col :span="24">
              <div class="flex justify-between h3">
                <div>{{ t("proxy.form.title.otherConfig") }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.fallbackTo.label')"
                prop="fallbackTo"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >fallbackTo</span
                            >
                            {{
                              t("proxy.form.formItem.fallbackTo.description")
                            }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.fallbackTo.label") }}
                    </div>
                  </div>
                </template>
                <el-input
                  v-model="editForm.fallbackTo"
                  type="text"
                  :placeholder="t('proxy.form.formItem.fallbackTo.placeholder')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.fallbackTimeoutMs.label')"
                prop="fallbackTimeoutMs"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >fallbackTimeoutMs</span
                            >
                            <div
                              v-html="
                                t(
                                  'proxy.form.formItem.fallbackTimeoutMs.description'
                                )
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.fallbackTimeoutMs.label") }}
                    </div>
                  </div>
                </template>
                <el-input-number
                  v-model="editForm.fallbackTimeoutMs"
                  class="w-full"
                  :min="0"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.keepTunnelOpen.label')"
                prop="keepTunnelOpen"
                label-position="left"
                :rules="[
                  {
                    required: true,
                    message: t(
                      'proxy.form.formItem.keepTunnelOpen.requireMessage'
                    ),
                    trigger: 'blur'
                  }
                ]"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >keepTunnelOpen</span
                            >
                            {{
                              t(
                                "proxy.form.formItem.keepTunnelOpen.description"
                              )
                            }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("proxy.form.formItem.keepTunnelOpen.label") }}
                    </div>
                  </div>
                </template>
                <el-switch
                  v-model="editForm.keepTunnelOpen"
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                />
              </el-form-item>
            </el-col>
          </template>
          <el-col :span="24" />

          <template v-if="!isStcpVisitors">
            <el-col :span="24">
              <div class="flex justify-between h3">
                <div>{{ t("proxy.form.title.proxyTransportConfig") }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.transportUseCompression.label')"
                prop="transport.useCompression"
                label-position="left"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >transport.useCompression</span
                            >
                            {{
                              t(
                                "proxy.form.formItem.transportUseCompression.description"
                              )
                            }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{
                        t("proxy.form.formItem.transportUseCompression.label")
                      }}
                    </div>
                  </div>
                </template>
                <el-switch
                  v-model="editForm.transport.useCompression"
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('proxy.form.formItem.transportUseEncryption.label')"
                prop="transport.useEncryption"
                label-position="left"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >transport.useEncryption</span
                            >
                            {{
                              t(
                                "proxy.form.formItem.transportUseEncryption.description"
                              )
                            }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{
                        t("proxy.form.formItem.transportUseEncryption.label")
                      }}
                    </div>
                  </div>
                </template>
                <el-switch
                  v-model="editForm.transport.useEncryption"
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="
                  t('proxy.form.formItem.transportProxyProtocolVersion.label')
                "
                prop="transport.proxyProtocolVersion"
                label-position="left"
              >
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="350">
                          <template #default>
                            {{ t("common.frpParameter") }}:
                            <span class="font-black text-[#5A3DAA]"
                              >transport.proxyProtocolVersion</span
                            >
                            {{
                              t(
                                "proxy.form.formItem.transportProxyProtocolVersion.description"
                              )
                            }}
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="#5A3DAA"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{
                        t(
                          "proxy.form.formItem.transportProxyProtocolVersion.label"
                        )
                      }}
                    </div>
                  </div>
                </template>
                <el-radio-group
                  v-model="editForm.transport.proxyProtocolVersion"
                >
                  <el-radio
                    :label="
                      t(
                        'proxy.form.formItem.transportProxyProtocolVersion.empty'
                      )
                    "
                    value=""
                  />
                  <el-radio label="v1" value="v1" />
                  <el-radio label="v2" value="v2" />
                </el-radio-group>
              </el-form-item>
            </el-col>
          </template>

          <el-col :span="24">
            <el-form-item>
              <div class="flex justify-end w-full">
                <el-button @click="edit.visible = false">
                  <iconify-icon-offline
                    class="mr-2 cursor-pointer"
                    icon="cancel-presentation"
                  />
                  {{ t("common.close") }}
                </el-button>
                <el-button plain type="primary" @click="handleSubmit">
                  <IconifyIconOffline
                    class="mr-2 cursor-pointer"
                    icon="save-rounded"
                  />
                  {{ t("common.save") }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-drawer>
    <!--    </el-dialog>-->

    <el-dialog
      v-model="listPortsVisible"
      :title="t('proxy.dialog.listPorts.title')"
      width="600"
      top="5%"
    >
      <el-table
        v-loading="loading.localPorts"
        :data="localPorts"
        stripe
        border
        height="400"
      >
        <el-table-column
          :label="t('proxy.dialog.listPorts.table.columns.protocol')"
          :width="100"
          prop="protocol"
        />
        <el-table-column
          :label="t('proxy.dialog.listPorts.table.columns.ip')"
          prop="ip"
        />
        <el-table-column
          :label="t('proxy.dialog.listPorts.table.columns.port')"
          :width="80"
          prop="port"
        />
        <el-table-column :label="t('common.operation')" :width="100">
          <template #default="scope">
            <el-button
              type="text"
              @click="handleSelectLocalPort(scope.row.port)"
            >
              <IconifyIconOffline
                class="mr-2 cursor-pointer"
                icon="gesture-select"
              />
              {{ t("common.select") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.http {
  background: #d3585b;
}

.tcp {
  background: #7bbc71;
}

.https {
  background: #5f3bb0;
}

.udp {
  background: #5ec7fe;
}

.stcp {
  background: #d63da6;
}

.xtcp {
  background: #f8bf4b;
}

.sudp {
  background: #3d4bb9;
}

.domain-input {
  width: calc(100% - 115px);
}

.local-port-input {
  width: calc(100% - 120px);
}

.proxy-name-input {
  // width: calc(100% - 130px);
}

.domain-input-button {
  background: #5f3bb0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  margin-left: 10px;
  cursor: pointer;
}

:deep(.el-drawer__header) {
  margin-bottom: 10px;
}

:deep(.el-drawer__body) {
  //padding-top: 0;
}

.button-input {
  width: calc(100% - 68px);
}
</style>
