<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import _ from "lodash";
import path from "path";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  reactive,
  ref
} from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
import commonIps from "./commonIp.json";

defineComponent({
  name: "Proxy"
});

const { t } = useI18n();

const proxys = ref<Array<FrpcProxy>>([]);
const loading = ref({
  list: 1,
  form: 0,
  localPorts: 1
});

const localPorts = ref<Array<LocalPort>>([]);
const listPortsVisible = ref(false);

const edit = ref({
  title: t("proxy.addTitle"),
  visible: false
});

const defaultForm: FrpcProxy = {
  _id: "",
  hostHeaderRewrite: "",
  locations: [],
  name: "",
  type: "http",
  localIP: "",
  localPort: "8080",
  remotePort: "8080",
  customDomains: [""],
  visitorsModel: "visitors",
  serverName: "",
  secretKey: "",
  bindAddr: "",
  bindPort: null,
  subdomain: "",
  basicAuth: false,
  httpUser: "",
  httpPassword: "",
  fallbackTo: "",
  fallbackTimeoutMs: 500,
  https2http: false,
  https2httpCaFile: "",
  https2httpKeyFile: "",
  keepTunnelOpen: false,
  status: 1,
  transport: {
    useEncryption: false,
    useCompression: false
  }
};

const editForm = ref<FrpcProxy>(_.cloneDeep(defaultForm));

const proxyTypes = ref(["http", "https", "tcp", "udp", "stcp", "xtcp", "sudp"]);
const currSelectLocalFileType = ref();
const hasPlugin = ref(false);

const visitorsModels = ref([
  {
    label: t("proxy.visitors"),
    value: "visitors"
  },
  {
    label: t("proxy.visitorsProvider"),
    value: "visitorsProvider"
  }
]);

const editFormRules = reactive<FormRules>({
  name: [
    {
      required: true,
      message: t("proxy.form.formItem.name.requireMessage"),
      trigger: "blur"
    }
    // {
    //   pattern: /^[a-zA-Z]+$/,
    //   message: "名称只能是英文",
    //   trigger: "blur"
    // }
  ],
  type: [
    {
      required: true,
      message: t("proxy.form.formItem.type.requireMessage"),
      trigger: "blur"
    }
  ],
  localIP: [
    {
      required: true,
      message: t("proxy.form.formItem.localIP.requireMessage"),
      trigger: "blur"
    },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: t("proxy.form.formItem.localIP.patternMessage"),
      trigger: "blur"
    }
  ],
  localPort: [
    {
      required: true,
      message: t("proxy.form.formItem.localPort.requireMessage"),
      trigger: "blur"
    },
    {
      pattern: /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
      message: t("proxy.form.formItem.localPort.patternMessage"),
      trigger: "blur"
    }
  ],
  remotePort: [
    {
      required: true,
      message: t("proxy.form.formItem.remotePort.requireMessage"),
      trigger: "blur"
    },
    {
      pattern: /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
      message: t("proxy.form.formItem.remotePort.patternMessage"),
      trigger: "blur"
    }
  ],
  visitorsModel: [
    {
      required: true,
      message: t("proxy.form.formItem.visitorsModel.requireMessage", {
        mode: editForm.value.type
      }),
      trigger: "blur"
    }
  ],
  secretKey: [
    {
      required: true,
      message: t("proxy.form.formItem.secretKey.requireMessage"),
      trigger: "blur"
    }
  ],
  serverName: [
    {
      required: true,
      message: t("proxy.form.formItem.serverName.requireMessage"),
      trigger: "blur"
    }
  ],
  bindAddr: [
    {
      required: true,
      message: t("proxy.form.formItem.bindAddr.requireMessage"),
      trigger: "blur"
    },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: t("proxy.form.formItem.bindAddr.patternMessage"),
      trigger: "blur"
    }
  ],
  bindPort: [
    {
      required: true,
      message: t("proxy.form.formItem.bindPort.requireMessage"),
      trigger: "blur"
    }
  ],
  basicAuth: [
    {
      required: true,
      message: t("proxy.form.formItem.basicAuth.requireMessage"),
      trigger: "blur"
    }
  ],
  httpUser: [
    {
      required: true,
      message: t("proxy.form.formItem.httpUser.requireMessage"),
      trigger: "blur"
    }
  ],
  httpPassword: [
    {
      required: true,
      message: t("proxy.form.formItem.httpPassword.requireMessage"),
      trigger: "blur"
    }
  ],
  "transport.useEncryption": [
    {
      required: true,
      message: t("proxy.form.formItem.transportUseEncryption.requireMessage"),
      trigger: "blur"
    }
  ],
  "transport.useCompression": [
    {
      required: true,
      message: t("proxy.form.formItem.transportUseCompression.requireMessage"),
      trigger: "blur"
    }
  ]
});

const editFormRef = ref<FormInstance>();

const isTcp = computed(() => {
  return editForm.value.type === "tcp";
});

const isUdp = computed(() => {
  return editForm.value.type === "udp";
});

const isHttp = computed(() => {
  return editForm.value.type === "http";
});

const isHttps = computed(() => {
  return editForm.value.type === "https";
});

const isStcp = computed(() => {
  return editForm.value.type === "stcp";
});

const isSudp = computed(() => {
  return editForm.value.type === "sudp";
});

const isXtcp = computed(() => {
  return editForm.value.type === "xtcp";
});

const isStcpvisitorsProvider = computed(() => {
  return (
    (editForm.value.type === "stcp" ||
      editForm.value.type === "sudp" ||
      editForm.value.type === "xtcp") &&
    editForm.value.visitorsModel === "visitorsProvider"
  );
});

const isStcpVisitors = computed(() => {
  return (
    (editForm.value.type === "stcp" ||
      editForm.value.type === "sudp" ||
      editForm.value.type === "xtcp") &&
    editForm.value.visitorsModel === "visitors"
  );
});

const frpcConfig = ref<FrpConfig>();

const handleGetPortCount = (portString: string) => {
  let count = 0;
  const portRanges = portString.split(",");

  portRanges.forEach(range => {
    if (range.includes("-")) {
      const [start, end] = range.split("-").map(Number);
      count += end - start + 1;
    } else {
      count += 1;
    }
  });

  return count;
};

const handleRangePort = () => {
  if (isHttp.value || isHttps.value) {
    return false;
  }
  console.log(editForm.value);
  if (String(editForm.value.localPort).indexOf("-") !== -1) {
    return true;
  }
  if (String(editForm.value.localPort).indexOf(",") !== -1) {
    return true;
  }
  if (String(editForm.value.remotePort).indexOf("-") !== -1) {
    return true;
  }
  if (String(editForm.value.remotePort).indexOf(",") !== -1) {
    return true;
  }
  return false;
};

const handleSubmit = async () => {
  if (!editFormRef.value) return;
  editFormRef.value.validate(valid => {
    if (valid) {
      if (handleRangePort()) {
        const lc = handleGetPortCount(editForm.value.localPort);
        const rc = handleGetPortCount(editForm.value.remotePort);
        console.log("范围端口 ", lc, rc);
        if (lc !== rc) {
          ElMessage({
            type: "warning",
            message: "请确保内网端口和外网端口数量一致"
          });
          return;
        }
      }

      if (
        (isHttp.value || isHttps.value) &&
        !(
          editForm.value.subdomain ||
          editForm.value.customDomains.filter(f => f !== "").length > 0
        )
      ) {
        ElMessage({
          type: "warning",
          message: t("proxy.form.formItem.customDomains.requireMessage")
        });
        return;
      }
      loading.value.form = 1;
      const data = _.cloneDeep(editForm.value);
      console.log("submit", data);
      if (data._id) {
        send(ipcRouters.PROXY.modifyProxy, data);
      } else {
        send(ipcRouters.PROXY.createProxy, data);
      }
    }
  });
};

const handleAddDomain = () => {
  editForm.value.customDomains.push("");
};

const handleDeleteDomain = (index: number) => {
  editForm.value.customDomains.splice(index, 1);
};

const handleLoadProxies = () => {
  send(ipcRouters.PROXY.getAllProxies);
};

const handleLoadFrpcConfig = () => {
  send(ipcRouters.SERVER.getServerConfig);
};

const handleDeleteProxy = (proxy: FrpcProxy) => {
  send(ipcRouters.PROXY.deleteProxy, proxy._id);
  // ipcRenderer.send("proxy.deleteProxyById", proxy._id);
};

const handleResetForm = () => {
  editForm.value = _.cloneDeep(defaultForm);
};

const handleOpenInsert = () => {
  edit.value = {
    title: "新增代理",
    visible: true
  };
};

const handleOpenUpdate = (proxy: FrpcProxy) => {
  editForm.value = _.cloneDeep(proxy);
  // if (!editForm.value.fallbackTimeoutMs) {
  //   editForm.value.fallbackTimeoutMs = defaultForm.fallbackTimeoutMs;
  // }
  edit.value = {
    title: t("proxy.editTitle"),
    visible: true
  };
};

const handleReversalUpdate = (proxy: FrpcProxy) => {
  send(ipcRouters.PROXY.modifyProxyStatus, {
    id: proxy._id,
    status: proxy.status === 1 ? 0 : 1
  });
};

const handleLoadLocalPorts = () => {
  loading.value.localPorts = 1;
  // ipcRenderer.send("local.getLocalPorts");
  send(ipcRouters.PROXY.getLocalPorts);
};

const handleSelectLocalPort = useDebounceFn((port: number) => {
  editForm.value.localPort = port?.toString();
  editForm.value.localIP = "127.0.0.1";
  handleCloseLocalPortDialog();
});

const handleCloseLocalPortDialog = () => {
  listPortsVisible.value = false;
};

const handleOpenLocalPortDialog = () => {
  listPortsVisible.value = true;
  handleLoadLocalPorts();
};

// const allowCopyAccessAddress = (proxy: FrpcProxy) => {
//   if (
//     (proxy.type === "http" || proxy.type === "https") &&
//     (proxy.customDomains.length < 1 || !proxy.customDomains[0])
//   ) {
//     return false;
//   }
//   if (proxy.type === "stcp" && proxy.visitorsModel === "visitorsProvider") {
//     return false;
//   }
//   if (proxy.type === "xtcp" && proxy.visitorsModel === "visitorsProvider") {
//     return false;
//   }
//   if (proxy.type === "sudp" && proxy.visitorsModel === "visitorsProvider") {
//     return false;
//   }
//   return true;
// };

const handleCopyString = (str: string) => {
  const { copy, copied } = useClipboard();
  copy(str);
  ElMessage({
    type: "success",
    message: t("proxy.message.copySuccess")
  });
};

interface RestaurantItem {
  value: string;
}

const commonIp = ref<Array<RestaurantItem>>(commonIps);

const handleAutocompleteIP = (input: string) => {
  const parts = input.split(".").map(part => part.trim());

  const possibleIPs = [];
  if (parts.length === 1 && /^[0-9]{1,3}$/.test(parts[0])) {
    for (let i = 0; i <= 255; i++) {
      possibleIPs.push({ value: `${parts[0]}.${i}.0.1` });
    }
  } else if (
    parts.length === 2 &&
    /^[0-9]{1,3}$/.test(parts[0]) &&
    /^[0-9]{1,3}$/.test(parts[1])
  ) {
    for (let i = 0; i <= 255; i++) {
      possibleIPs.push({ value: `${parts[0]}.${parts[1]}.${i}.1` });
    }
  } else if (
    parts.length === 3 &&
    /^[0-9]{1,3}$/.test(parts[0]) &&
    /^[0-9]{1,3}$/.test(parts[1]) &&
    /^[0-9]{1,3}$/.test(parts[2])
  ) {
    for (let i = 1; i <= 255; i++) {
      possibleIPs.push({ value: `${parts[0]}.${parts[1]}.${parts[2]}.${i}` });
    }
  } else if (
    parts.length === 4 &&
    /^[0-9]{1,3}$/.test(parts[0]) &&
    /^[0-9]{1,3}$/.test(parts[1]) &&
    /^[0-9]{1,3}$/.test(parts[2]) &&
    /^[0-9]{1,3}$/.test(parts[3])
  ) {
    possibleIPs.push({ value: input });
  }
  return possibleIPs;
};

const handleIpFetchSuggestions = (queryString: string, cb: any) => {
  const auto = handleAutocompleteIP(queryString);
  // const results = queryString
  //   ? commonIp.value.filter(f => {
  //       return f.value.toLowerCase().indexOf(queryString.toLowerCase()) !== -1;
  //     })
  //   : commonIp.value;
  // const newVar = [...results, ...auto];
  // return Array.from(newVar).map(ip => ({ value: ip }));
  cb(auto);
};

const handleRandomProxyName = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  editForm.value.name =
    `df_${editForm.value.type}_${result}`.toLocaleLowerCase();
};

const normalizePath = (filePath: string) => {
  return path.normalize(filePath).replace(/\\/g, "/");
};

const handleSelectFile = (type: number, ext: string[]) => {
  currSelectLocalFileType.value = type;
  send(ipcRouters.SYSTEM.selectLocalFile, {
    name: "",
    extensions: ext
  });
  // ipcRenderer.invoke("file.selectFile", ext).then(r => {
  //   switch (type) {
  //     case 1:
  //       editForm.value.https2httpCaFile = normalizePath(r[0]);
  //       break;
  //     case 2:
  //       editForm.value.https2httpKeyFile = normalizePath(r[0]);
  //       break;
  //   }
  //   console.log(r);
  // });
};

onMounted(() => {
  handleLoadProxies();
  handleLoadFrpcConfig();

  on(ipcRouters.SERVER.getServerConfig, data => {
    console.log("data", data);
    if (data) {
      frpcConfig.value = data;
    }
  });

  on(ipcRouters.PROXY.getAllProxies, data => {
    console.log("allProxies", data);
    loading.value.list--;
    proxys.value = data;
  });

  on(ipcRouters.SYSTEM.selectLocalFile, data => {
    console.log("data", data);
    if (!data.canceled) {
      switch (currSelectLocalFileType.value) {
        case 1:
          editForm.value.https2httpCaFile = data.path as string;
          break;
        case 2:
          editForm.value.https2httpKeyFile = data.path as string;
          break;
      }
    }
  });

  const insertOrUpdateHook = (message: string) => {
    loading.value.form--;
    // const { err } = args;
    // if (!err) {
    ElMessage({
      type: "success",
      message: message
    });
    handleResetForm();
    handleLoadProxies();
    edit.value.visible = false;
    // }
  };

  on(ipcRouters.PROXY.createProxy, data => {
    insertOrUpdateHook(t("common.createSuccess"));
  });

  on(ipcRouters.PROXY.modifyProxy, data => {
    insertOrUpdateHook(t("common.modifySuccess"));
  });

  on(ipcRouters.PROXY.deleteProxy, () => {
    handleLoadProxies();
    ElMessage({
      type: "success",
      message: t("common.deleteSuccess")
    });
  });

  on(ipcRouters.PROXY.modifyProxyStatus, () => {
    ElMessage({
      type: "success",
      message: t("common.modifySuccess")
    });
    // handleResetForm();
    handleLoadProxies();
    // edit.value.visible = false;
  });

  on(ipcRouters.PROXY.getLocalPorts, data => {
    loading.value.localPorts--;
    localPorts.value = data;
  });
});

const handleProxyTypeChange = e => {
  if (e === "http" || e === "https" || e === "tcp" || e === "udp") {
    if (e === "https") {
      hasPlugin.value = true;
    } else {
      hasPlugin.value = false;
    }
    editForm.value.visitorsModel = "";
  } else {
    if (editForm.value.visitorsModel === "") {
      editForm.value.visitorsModel = "visitorsProvider";
    }
  }
};

onUnmounted(() => {
  removeRouterListeners(ipcRouters.PROXY.createProxy);
  removeRouterListeners(ipcRouters.PROXY.modifyProxy);
  removeRouterListeners(ipcRouters.PROXY.deleteProxy);
  removeRouterListeners(ipcRouters.PROXY.getAllProxies);
  removeRouterListeners(ipcRouters.PROXY.modifyProxyStatus);
  removeRouterListeners(ipcRouters.PROXY.getLocalPorts);
  removeRouterListeners(ipcRouters.SYSTEM.selectLocalFile);
});
</script>
<template>
  <!--  <coming-soon />-->
  <div class="main">
    <breadcrumb>
      <el-button type="primary" @click="handleOpenInsert">
        <IconifyIconOffline icon="add" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb" v-loading="loading.list > 0">
      <template v-if="proxys && proxys.length > 0">
        <el-row :gutter="15">
          <el-col
            v-for="proxy in proxys"
            :key="proxy._id"
            :lg="8"
            :md="8"
            :sm="12"
            :xl="6"
            :xs="12"
            class="mb-[15px]"
          >
            <div
              class="flex items-center justify-between w-full h-full p-4 bg-white rounded left-border drop-shadow animate__animated"
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
                    size="small"
                    class="ml-2"
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitorsProvider'
                    "
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
                    class="text-[12px]"
                    v-if="
                      (proxy.type !== 'stcp' &&
                        proxy.type !== 'xtcp' &&
                        proxy.type !== 'sudp') ||
                      proxy.visitorsModel !== 'visitors'
                    "
                  >
                    <span>{{ t("proxy.inner") }}：</span>
                    <span class="font-bold text-primary">
                      {{ proxy.localIP }}:{{ proxy.localPort }}
                    </span>
                  </div>

                  <div
                    class="text-[12px] cursor-pointer"
                    v-if="proxy.type === 'tcp' || proxy.type === 'udp'"
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
                    class="text-[12px]"
                    v-if="
                      (proxy.type === 'http' || proxy.type === 'https') &&
                      proxy.customDomains &&
                      proxy.customDomains.length > 0
                    "
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
                    class="text-[12px]"
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitors'
                    "
                  >
                    <span>{{ t("proxy.visitorsName") }}：</span>
                    <span class="font-bold text-primary">{{
                      proxy.serverName
                    }}</span>
                  </div>
                  <div
                    class="text-[12px]"
                    v-if="
                      (proxy.type === 'stcp' ||
                        proxy.type === 'xtcp' ||
                        proxy.type === 'sudp') &&
                      proxy.visitorsModel === 'visitors'
                    "
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
                <div class="flex flex-col items-center gap-1">
                  <el-button
                    type="text"
                    size="small"
                    @click="handleOpenUpdate(proxy)"
                  >
                    <template #icon>
                      <IconifyIconOffline icon="edit" />
                    </template>
                    {{ t("common.edit") }}
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
        class="flex items-center justify-center w-full h-full p-2 overflow-hidden bg-white rounded drop-shadow-xl"
      >
        <el-empty :description="t('proxy.form.noProxy')" />
      </div>
    </div>

    <el-drawer
      :title="edit.title"
      v-model="edit.visible"
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
        v-loading="loading.form"
        label-position="top"
        :model="editForm"
        :rules="editFormRules"
        ref="editFormRef"
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
                  type="password"
                  v-model="editForm.secretKey"
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
              <div class="flex w-full gap-2">
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
                <div class="flex w-full gap-2">
                  <el-input-number
                    v-if="isHttp || isHttps"
                    placeholder="8080"
                    class="w-full"
                    :min="0"
                    :max="65535"
                    v-model="editForm.localPort"
                    controls-position="right"
                  />
                  <el-input
                    v-else
                    placeholder="8080"
                    v-model="editForm.localPort"
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
                  class="w-full"
                  placeholder="8080"
                  v-model="editForm.remotePort"
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
                  class="w-full"
                  placeholder="subdomain"
                  v-model="editForm.subdomain"
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
                    message: '请输入正确的域名',
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
                  class="domain-input"
                  placeholder="domain.com"
                  v-model="editForm.customDomains[di]"
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
                  @click="handleDeleteDomain(di)"
                  :disabled="editForm.customDomains.length === 1"
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
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                  v-model="editForm.basicAuth"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="editForm.basicAuth">
              <el-form-item
                :label="t('proxy.form.formItem.httpUser.label')"
                prop="httpUser"
              >
                <el-input
                  class="w-full"
                  placeholder="httpUser"
                  v-model="editForm.httpUser"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="editForm.basicAuth">
              <el-form-item
                :label="t('proxy.form.formItem.httpPassword.label')"
                prop="httpPassword"
              >
                <el-input
                  type="password"
                  class="w-full"
                  placeholder="httpPassword"
                  v-model="editForm.httpPassword"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
          </template>
          <template v-if="hasPlugin">
            <el-col :span="24" v-if="hasPlugin">
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
                    :active-text="t('common.yes')"
                    inline-prompt
                    :inactive-text="t('common.no')"
                    v-model="editForm.https2http"
                  />
                </el-form-item>
              </el-col>

              <el-col :span="24" v-if="editForm.https2http">
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
                    class="button-input"
                    v-model="editForm.https2httpCaFile"
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
              <el-col :span="24" v-if="editForm.https2http">
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
                    class="cursor-pointer button-input"
                    v-model="editForm.https2httpKeyFile"
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
                  type="text"
                  v-model="editForm.serverName"
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
                  type="text"
                  v-model="editForm.bindAddr"
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
                  class="w-full"
                  :min="-1"
                  :step="1"
                  controls-position="right"
                  v-model="editForm.bindPort"
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
                  type="text"
                  v-model="editForm.fallbackTo"
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
                  class="w-full"
                  :min="0"
                  :step="1"
                  controls-position="right"
                  v-model="editForm.fallbackTimeoutMs"
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
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                  v-model="editForm.keepTunnelOpen"
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
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                  v-model="editForm.transport.useCompression"
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
                  :active-text="t('common.yes')"
                  inline-prompt
                  :inactive-text="t('common.no')"
                  v-model="editForm.transport.useEncryption"
                />
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
        :data="localPorts"
        stripe
        v-loading="loading.localPorts"
        border
        height="400"
      >
        <el-table-column
          :label="t('proxy.dialog.listPorts.table.columns.protocol')"
          :width="60"
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
