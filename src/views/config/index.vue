<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { defineComponent } from "vue";
import { useConfig } from "./index";

defineComponent({
  name: "Config"
});

const {
  t,
  formData,
  loading,
  rules,
  copyServerConfigBase64,
  pasteServerConfigBase64,
  formRef,
  protocol,
  currSelectLocalFileType,
  frpcDesktopStore,
  visible,
  handleSubmit,
  handleMultiuserChange,
  handleSelectFile,
  handleCopyServerConfig2Base64,
  handlePasteServerConfig4Base64,
  handlePasteServerConfigBase64,
  handleShowExportDialog,
  handleExportConfig,
  handleImportConfig,
  handleResetConfig,
  handleOpenDataFolder,
  handleSystemLanguageChange
} = useConfig();
</script>
<template>
  <div class="main">
    <breadcrumb>
      <el-button plain type="primary" @click="handleOpenDataFolder">
        <IconifyIconOffline icon="folder-rounded" />
      </el-button>
      <el-button plain type="primary" @click="handleResetConfig">
        <IconifyIconOffline icon="deviceReset" />
      </el-button>
      <el-button plain type="primary" @click="handleImportConfig">
        <IconifyIconOffline icon="file-open-rounded" />
      </el-button>
      <el-button plain type="primary" @click="handleExportConfig">
        <IconifyIconOffline icon="file-save-rounded" />
      </el-button>
      <el-button type="primary" @click="handleSubmit">
        <IconifyIconOffline icon="save-rounded" />
      </el-button>
    </breadcrumb>
    <div v-loading="loading > 0" class="pr-2 app-container-breadcrumb">
      <div class="p-4 w-full bg-white rounded drop-shadow-lg">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="rules"
          label-position="right"
          label-width="150"
        >
          <el-row :gutter="10">
            <el-col :span="24">
              <div class="flex justify-between h2">
                <div>{{ t("config.title.versionSelection") }}</div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.frpcVerson.label')"
                prop="frpcVersion"
              >
                <el-select
                  v-model="formData.frpcVersion"
                  class="w-full"
                  clearable
                >
                  <el-option
                    v-for="v in frpcDesktopStore.downloadedVersions"
                    :key="v.githubReleaseId"
                    :label="v.name"
                    :value="v.githubReleaseId"
                  />
                </el-select>
                <div class="flex justify-end w-full">
                  <el-link
                    type="primary"
                    @click="frpcDesktopStore.refreshDownloadedVersion()"
                  >
                    <iconify-icon-offline class="mr-1" icon="refresh-rounded" />
                    {{ t("config.button.manualRefresh") }}
                  </el-link>
                  <el-link
                    class="ml-2"
                    type="primary"
                    @click="$router.replace({ name: 'Versions' })"
                  >
                    <IconifyIconOffline class="mr-1" icon="download" />
                    {{ t("config.button.goToDownload") }}
                  </el-link>
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="flex justify-between h2">
                <div>{{ t("config.title.serverConfiguration") }}</div>
                <div class="flex justify-center items-center">
                  <IconifyIconOffline
                    class="mr-2 text-xl font-bold cursor-pointer"
                    icon="content-copy"
                    @click="handleCopyServerConfig2Base64"
                  />
                  <IconifyIconOffline
                    class="mr-2 text-xl font-bold cursor-pointer"
                    icon="content-paste-go"
                    @click="handlePasteServerConfig4Base64"
                  />
                </div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.serverAddr.label')"
                prop="serverAddr"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" trigger="hover" width="300">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.serverAddr.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.serverAddr.label") }}
                </template>
                <el-input
                  v-model="formData.serverAddr"
                  placeholder="127.0.0.1"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.serverPort.label')"
                prop="serverPort"
              >
                <el-input-number
                  v-model="formData.serverPort"
                  placeholder="7000"
                  :min="0"
                  :max="65535"
                  controls-position="right"
                  class="!w-full"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.authMethod.label')"
                prop="auth.method"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:
                        <span class="font-black text-[#5A3DAA]"
                          >auth.method</span
                        >
                      </template>
                      <template #reference>
                        <!--                        <IconifyIconOffline class="text-base" color="#5A3DAA" icon="info"/>-->
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.authMethod.label") }}
                </template>
                <el-select
                  v-model="formData.auth.method"
                  :placeholder="t('config.form.authMethod.requireMessage')"
                  clearable
                >
                  <el-option
                    :label="t('config.form.authMethod.none')"
                    value="none"
                  ></el-option>
                  <el-option
                    :label="t('config.form.authMethod.token')"
                    value="token"
                  ></el-option>
                  <!--                  <el-option label="多用户" value="multiuser"></el-option>-->
                </el-select>
              </el-form-item>
            </el-col>
            <el-col v-if="formData.auth.method === 'token'" :span="24">
              <el-form-item
                :label="t('config.form.authToken.label')"
                prop="authToken"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" trigger="hover" width="300">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >auth.token</span
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
                  {{ t("config.form.authToken.label") }}
                </template>
                <el-input
                  v-model="formData.auth.token"
                  placeholder="token"
                  type="password"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.multiuser.label')"
                prop="multiuser"
              >
                <!--
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" trigger="hover">
                      <template #default> 是否开启多用户模式 </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.multiuser.label") }}
                </template>
                -->
                <el-switch
                  v-model="formData.multiuser"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                  @change="handleMultiuserChange"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="formData.multiuser" :span="12">
              <el-form-item :label="t('config.form.user.label')" prop="user">
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" trigger="hover" width="300">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >user</span
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
                  {{ t("config.form.user.label") }}
                </template>
                <el-input
                  v-model="formData.user"
                  :placeholder="t('config.form.user.placeholder')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="formData.multiuser" :span="12">
              <el-form-item
                :label="t('config.form.metadatasToken.label')"
                prop="metadatas.token"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >metadatas.token</span
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
                  {{ t("config.form.metadatasToken.label") }}
                </template>
                <el-input
                  v-model="formData.metadatas.token"
                  :placeholder="t('config.form.metadatasToken.placeholder')"
                  type="password"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
            <!-- <el-col :span="24">
              <div class="h2">TLS Config</div>
            </el-col> -->

            <el-col :span="24">
              <div class="h2">
                {{ t("config.title.transportConfiguration") }}
              </div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportProtocol.label')"
                prop="transport.protocol"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportProtocol.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.transportProtocol.label") }}
                </template>
                <el-select v-model="formData.transport.protocol">
                  <el-option label="tcp" value="tcp" />
                  <el-option label="kcp" value="kcp" />
                  <el-option label="quic" value="quic" />
                  <el-option label="websocket" value="websocket" />
                  <el-option label="wss" value="wss" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportPoolCount.label')"
                prop="transport.poolCount"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.poolCount</span
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
                  {{ t("config.form.transportPoolCount.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.poolCount"
                  class="w-full"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportHeartbeatInterval.label')"
                prop="transport.heartbeatInterval"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportHeartbeatInterval.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
                          "
                        />
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
                  {{ t("config.form.transportHeartbeatInterval.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.heartbeatInterval"
                  class="w-full"
                  :min="1"
                  :max="600"
                  controls-position="right"
                />
                <!--                <el-input-->
                <!--                    placeholder="请输入心跳间隔"-->
                <!--                    type="number"-->
                <!--                    :min="0"-->
                <!--                    v-model="formData.heartbeatInterval"-->
                <!--                >-->
                <!--                  <template #append>秒</template>-->
                <!--                </el-input>-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportHeartbeatTimeout.label')"
                prop="transport.heartbeatTimeout"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportHeartbeatTimeout.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
                          "
                        />
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
                  {{ t("config.form.transportHeartbeatTimeout.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.heartbeatTimeout"
                  class="w-full"
                  :min="1"
                  :max="600"
                  controls-position="right"
                />
                <!--                <el-input-->
                <!--                    placeholder="请输入心跳超时时间"-->
                <!--                    :min="0"-->
                <!--                    type="number"-->
                <!--                    v-model="formData.heartbeatTimeout"-->
                <!--                >-->
                <!--                  <template #append>秒</template>-->
                <!--                </el-input>-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportDialServerTimeout.label')"
                prop="transport.dialServerTimeout"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportDialServerTimeout.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.transportDialServerTimeout.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.dialServerTimeout"
                  class="w-full"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportDialServerKeepalive.label')"
                prop="transport.dialServerKeepalive"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportDialServerKeepalive.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.transportDialServerKeepalive.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.dialServerKeepalive"
                  class="w-full"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>

            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportTcpMux.label')"
                prop="transport.tcpMux"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.transportTcpMux.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.transportTcpMux.label") }}
                </template>
                <el-switch
                  v-model="formData.transport.tcpMux"
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="formData.transport.tcpMux" :span="12">
              <el-form-item
                :label="t('config.form.transportTcpMuxKeepaliveInterval.label')"
                prop="transport.tcpMuxKeepaliveInterval"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t(
                              'config.form.transportTcpMuxKeepaliveInterval.tips',
                              {
                                frpParameter: t('config.popover.frpParameter')
                              }
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
                  {{ t("config.form.transportTcpMuxKeepaliveInterval.label") }}
                </template>
                <el-input-number
                  v-model="formData.transport.tcpMuxKeepaliveInterval"
                  class="w-full"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <!--            <el-col :span="24">-->
            <!--              <el-form-item label="启用代理：" prop="proxyConfigEnable">-->
            <!--                <el-switch-->
            <!--                  active-text="开"-->
            <!--                  inline-prompt-->
            <!--                  inactive-text="关"-->
            <!--                  v-model="formData.proxyConfigEnable"-->
            <!--                />-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->
            <!--            <template v-if="formData.proxyConfigEnable">-->
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.transportProxyURL.label')"
                prop="transport.proxyURL"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.proxyURL</span
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
                  {{ t("config.form.transportProxyURL.label") }}
                </template>
                <el-input
                  v-model="formData.transport.proxyURL"
                  placeholder="http://user:pwd@192.168.1.128:8080"
                />
              </el-form-item>
            </el-col>
            <!--            </template>-->
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.tlsEnable.label')"
                prop="transport.tls.enable"
                label-width="180"
              >
                <el-switch
                  v-model="formData.transport.tls.enable"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                />
              </el-form-item>
            </el-col>
            <template v-if="formData.transport.tls.enable">
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsCertFile.label')"
                  prop="tlsConfigCertFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center mr-1 h-full">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.certFile</span
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
                    {{ t("config.form.tlsCertFile.label") }}
                  </template>
                  <el-input
                    v-model="formData.transport.tls.certFile"
                    class="button-input !cursor-pointer"
                    :placeholder="t('config.form.tlsCertFile.placeholder')"
                    readonly
                    clearable
                    @click="handleSelectFile(1, ['crt'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(1, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.certFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.certFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsKeyFile.label')"
                  prop="transport.tls.keyFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center mr-1 h-full">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.keyFile</span
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
                    {{ t("config.form.tlsKeyFile.label") }}
                  </template>
                  <el-input
                    v-model="formData.transport.tls.keyFile"
                    class="button-input"
                    :placeholder="t('config.form.tlsKeyFile.placeholder')"
                    readonly
                    @click="handleSelectFile(2, ['key'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(2, ['key'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.keyFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.keyFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.caCertFile.label')"
                  prop="transport.tls.trustedCaFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center mr-1 h-full">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.trustedCaFile</span
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
                    {{ t("config.form.caCertFile.label") }}
                  </template>
                  <el-input
                    v-model="formData.transport.tls.trustedCaFile"
                    class="button-input"
                    :placeholder="t('config.form.caCertFile.placeholder')"
                    readonly
                    @click="handleSelectFile(3, ['crt'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(3, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.trustedCaFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.trustedCaFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsServerName.label')"
                  prop="tlsConfigServerName"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center mr-1 h-full">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.serverName</span
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
                    {{ t("config.form.tlsServerName.label") }}
                  </template>
                  <el-input
                    v-model="formData.transport.tls.serverName"
                    :placeholder="t('config.form.tlsServerName.placeholder')"
                    clearable
                  />
                </el-form-item>
              </el-col>
            </template>

            <el-col :span="24">
              <div class="h2">{{ t("config.title.webInterface") }}</div>
            </el-col>

            <!--            <el-col :span="12">-->
            <!--              <el-form-item label="启用Web界面：" prop="webEnable">-->
            <!--                <template #label>-->
            <!--                  <div class="flex items-center mr-1 h-full">-->
            <!--                    <el-popover width="300" placement="top" trigger="hover">-->
            <!--                      <template #reference>-->
            <!--                        <IconifyIconOffline-->
            <!--                          class="text-base"-->
            <!--                          color="#5A3DAA"-->
            <!--                          icon="info"-->
            <!--                        />-->
            <!--                      </template>-->
            <!--                      热更新等功能依赖于web界面，<span-->
            <!--                        class="font-black text-[#5A3DAA]"-->
            <!--                        >不可停用Web</span-->
            <!--                      >-->
            <!--                    </el-popover>-->
            <!--                  </div>-->
            <!--                  启用Web：-->
            <!--                </template>-->
            <!--                <el-switch-->
            <!--                  active-text="开"-->
            <!--                  inline-prompt-->
            <!--                  disabled-->
            <!--                  inactive-text="关"-->
            <!--                  v-model="formData.webServer."-->
            <!--                />-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->

            <!--            <template v-if="formData.webEnable">-->
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.webServerPort.label')"
                prop="webPort"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.webServerPort.tips', {
                              frpParameter: t('config.popover.frpParameter')
                            })
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
                  {{ t("config.form.webServerPort.label") }}
                </template>
                <el-input-number
                  v-model="formData.webServer.port"
                  placeholder="57400"
                  :min="0"
                  :max="65535"
                  controls-position="right"
                  class="w-full"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <!--            </template>-->

            <el-col :span="24">
              <div class="h2">{{ t("config.title.logConfiguration") }}</div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                class="!w-full"
                :label="t('config.form.logLevel.label')"
                prop="log.level"
              >
                <el-select v-model="formData.log.level">
                  <el-option label="info" value="info" />
                  <el-option label="debug" value="debug" />
                  <el-option label="warn" value="warn" />
                  <el-option label="error" value="error" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.logMaxDays.label')"
                prop="log.maxDays"
              >
                <el-input-number
                  v-model="formData.log.maxDays"
                  class="!w-full"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">{{ t("config.title.systemConfiguration") }}</div>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemLaunchAtStartup.label')"
                prop="system.launchAtStartup"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" width="300" trigger="hover">
                      <template #default>
                        <div
                          v-html="t('config.form.systemLaunchAtStartup.tips')"
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
                  {{ t("config.form.systemLaunchAtStartup.label") }}
                </template>
                <el-switch
                  v-model="formData.system.launchAtStartup"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemSilentStartup.label')"
                prop="system.silentStartup"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" width="300" trigger="hover">
                      <template #default>
                        <div
                          v-html="t('config.form.systemSilentStartup.tips')"
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
                  {{ t("config.form.systemSilentStartup.label") }}
                </template>
                <el-switch
                  v-model="formData.system.silentStartup"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemAutoConnectOnStartup.label')"
                prop="system.autoConnectOnStartup"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" width="300" trigger="hover">
                      <template #default>
                        <div
                          v-html="
                            t('config.form.systemAutoConnectOnStartup.tips')
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
                  {{ t("config.form.systemAutoConnectOnStartup.label") }}
                </template>
                <el-switch
                  v-model="formData.system.autoConnectOnStartup"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.systemLanguage.label')"
                prop="system.language"
              >
                <el-select
                  v-model="formData.system.language"
                  @change="handleSystemLanguageChange"
                >
                  <el-option label="中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </el-form-item>
            </el-col>
            <!--            <el-col :span="24">-->
            <!--              <el-form-item>-->
            <!--                <el-button plain type="primary" @click="handleSubmit">-->
            <!--                  <IconifyIconOffline icon="save" />-->
            <!--                  保 存-->
            <!--                </el-button>-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->
          </el-row>
        </el-form>
      </div>
    </div>
    <!--  链接导入服务器  -->
    <el-dialog
      v-model="visible.copyServerConfig"
      :title="t('config.dialog.copyLink.title')"
      width="500"
      top="5%"
    >
      <el-alert
        class="mb-4"
        :title="t('config.dialog.copyLink.warning.message')"
        type="warning"
        :closable="false"
      />
      <el-input
        v-model="copyServerConfigBase64"
        class="h-30"
        type="textarea"
        :rows="8"
      ></el-input>
    </el-dialog>
    <!--    链接导出服务器-->
    <el-dialog
      v-model="visible.pasteServerConfig"
      :title="t('config.dialog.importLink.title')"
      width="500"
      top="5%"
    >
      <el-input
        v-model="pasteServerConfigBase64"
        class="h-30"
        type="textarea"
        placeholder="frp://......"
        :rows="8"
      ></el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            plain
            type="primary"
            @click="handlePasteServerConfigBase64"
          >
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="label-important-rounded"
            />
            {{ t("config.button.import") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!--    配置导出-->
    <!--    <el-dialog-->
    <!--      v-model="visibles.exportConfig"-->
    <!--      title="导出配置"-->
    <!--      width="500"-->
    <!--      top="5%"-->
    <!--    >-->
    <!--      <el-alert-->
    <!--        class="mb-4"-->
    <!--        :title="`导出文件名为 frpc-desktop.${exportConfigType} 重复导出则覆盖`"-->
    <!--        type="warning"-->
    <!--        :closable="false"-->
    <!--      />-->
    <!--      <el-form>-->
    <!--        <el-form-item label="导出类型">-->
    <!--          <el-radio-group v-model="exportConfigType">-->
    <!--            <el-radio-button label="toml" value="toml" />-->
    <!--            <el-radio-button label="ini" value="ini" />-->
    <!--          </el-radio-group>-->
    <!--        </el-form-item>-->
    <!--      </el-form>-->
    <!--      <template #footer>-->
    <!--        <div class="dialog-footer">-->
    <!--          <el-button plain type="primary" @click="handleExportConfig">-->
    <!--            <IconifyIconOffline-->
    <!--              class="mr-2 cursor-pointer"-->
    <!--              icon="downloadRounded"-->
    <!--            />-->
    <!--            导 出-->
    <!--          </el-button>-->
    <!--        </div>-->
    <!--      </template>-->
    <!--    </el-dialog>-->
  </div>
</template>

<style lang="scss" scoped>
.button-input {
  width: calc(100% - 68px);
}
</style>
