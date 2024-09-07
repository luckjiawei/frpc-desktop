<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, reactive, ref } from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import { ipcRenderer } from "electron";
import { clone } from "@/utils/clone";
import { useDebounceFn } from "@vueuse/core";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import commonIps from "./commonIp.json";

defineComponent({
  name: "Proxy"
});

/**
 * 代理列表
 */
const proxys = ref<Array<Proxy>>([]);
/**
 * loading
 */
const loading = ref({
  list: 1,
  form: 0,
  localPorts: 1
});

const localPorts = ref<Array<LocalPort>>([]);
const listPortsVisible = ref(false);

/**
 * 弹出层属性
 */
const edit = ref({
  title: "新增代理",
  visible: false
});

const defaultForm = ref<Proxy>({
  _id: "",
  name: "",
  type: "http",
  localIp: "",
  localPort: "8080",
  remotePort: "8080",
  customDomains: [""],
  stcpModel: "visitors",
  serverName: "",
  secretKey: "",
  bindAddr: "",
  bindPort: null,
  status: true
});

/**
 * 表单内容
 */
const editForm = ref<Proxy>(defaultForm.value);

/**
 * 代理类型
 */
const proxyTypes = ref(["http", "https", "tcp", "udp", "stcp"]);

const stcpModels = ref([
  {
    label: "访问者",
    value: "visitors"
  },
  {
    label: "被访问者",
    value: "visited"
  }
]);

/**
 * 表单校验
 */
const editFormRules = reactive<FormRules>({
  name: [
    { required: true, message: "请输入名称", trigger: "blur" }
    // {
    //   pattern: /^[a-zA-Z]+$/,
    //   message: "名称只能是英文",
    //   trigger: "blur"
    // }
  ],
  type: [{ required: true, message: "请选择类型", trigger: "blur" }],
  localIp: [
    { required: true, message: "请输入内网地址", trigger: "blur" },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: "请输入正确的内网地址",
      trigger: "blur"
    }
  ],
  localPort: [
    { required: true, message: "请输入内网端口", trigger: "blur" },
    {
      pattern: /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
      message: "请输入正确的端口",
      trigger: "blur"
    }
  ],
  remotePort: [
    { required: true, message: "请输入外网端口", trigger: "blur" },
    {
      pattern: /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
      message: "请输入正确的端口",
      trigger: "blur"
    }
  ],
  stcpModel: [{ required: true, message: "请选择stcp模式", trigger: "blur" }],
  secretKey: [
    { required: true, message: "请输入stcp共享密钥", trigger: "blur" }
  ],
  serverName: [
    { required: true, message: "请输入stcp被访问者代理名称", trigger: "blur" }
  ],
  bindAddr: [
    { required: true, message: "请输入绑定的地址", trigger: "blur" },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: "请输入正确的内网地址",
      trigger: "blur"
    }
  ],
  bindPort: [{ required: true, message: "请输入绑定的端口", trigger: "blur" }]
});

/**
 * 表单dom
 */
const editFormRef = ref<FormInstance>();

const handleGetPortCount = (portString: string) => {
  let count = 0;
  const portRanges = portString.split(",");

  portRanges.forEach(range => {
    if (range.includes("-")) {
      // 处理范围
      const [start, end] = range.split("-").map(Number);
      count += end - start + 1; // 包括起始和结束端口
    } else {
      // 处理单个端口
      count += 1;
    }
  });

  return count;
};

const handleRangePort = () => {
  if (editForm.value.localPort.indexOf("-") !== -1) {
    return true;
  }
  if (editForm.value.localPort.indexOf(",") !== -1) {
    return true;
  }
  if (editForm.value.remotePort.indexOf("-") !== -1) {
    return true;
  }
  if (editForm.value.remotePort.indexOf(",") !== -1) {
    return true;
  }
  return false;
};

/**
 * 提交表单
 */
const handleSubmit = async () => {
  if (!editFormRef.value) return;
  await editFormRef.value.validate(valid => {
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
      loading.value.form = 1;
      const data = clone(editForm.value);
      if (data._id) {
        ipcRenderer.send("proxy.updateProxy", data);
      } else {
        ipcRenderer.send("proxy.insertProxy", data);
      }
    }
  });
};

/**
 * 添加代理域名
 */
const handleAddDomain = () => {
  editForm.value.customDomains.push("");
};

/**
 * 删除代理列表
 * @param index
 */
const handleDeleteDomain = (index: number) => {
  editForm.value.customDomains.splice(index, 1);
};

/**
 * 加载代理
 */
const handleLoadProxys = () => {
  ipcRenderer.send("proxy.getProxys");
};

/**
 * 删除代理
 * @param proxy
 */
const handleDeleteProxy = (proxy: Proxy) => {
  ipcRenderer.send("proxy.deleteProxyById", proxy._id);
};

/**
 * 重置表单
 */
const handleResetForm = () => {
  editForm.value = defaultForm.value;
};

/**
 * 初始化回调
 */
const handleInitHook = () => {
  const InsertOrUpdateHook = (message: string, args: any) => {
    loading.value.form--;
    const { err } = args;
    if (!err) {
      ElMessage({
        type: "success",
        message: message
      });
      handleResetForm();
      handleLoadProxys();
      edit.value.visible = false;
    }
  };

  ipcRenderer.on("Proxy.insertProxy.hook", (event, args) => {
    InsertOrUpdateHook("新增成功", args);
  });
  ipcRenderer.on("Proxy.updateProxy.hook", (event, args) => {
    InsertOrUpdateHook("修改成功", args);
  });

  ipcRenderer.on("Proxy.updateProxyStatus.hook", (event, args) => {
    if (args.data > 0) {
      handleLoadProxys();
    }
    console.log("更新结果", args);
  });

  ipcRenderer.on("local.getLocalPorts.hook", (event, args) => {
    loading.value.localPorts--;
    localPorts.value = args.data;
    console.log("内网端口", localPorts.value);
  });
  // ipcRenderer.on("Proxy.updateProxy.hook", (event, args) => {
  //   loading.value.form--;
  //   const { err } = args;
  //   if (!err) {
  //     ElMessage({
  //       type: "success",
  //       message: "修改成功"
  //     });
  //     handleResetForm();
  //     handleLoadProxys();
  //     edit.value.visible = false;
  //   }
  // });
  ipcRenderer.on("Proxy.getProxys.hook", (event, args) => {
    loading.value.list--;
    const { err, data } = args;
    if (!err) {
      data.forEach(f => {
        if (f.status === null || f.status === undefined) {
          f.status = true;
        }
      });
      proxys.value = data;
    }
  });
  ipcRenderer.on("Proxy.deleteProxyById.hook", (event, args) => {
    const { err, data } = args;
    if (!err) {
      handleLoadProxys();
      ElMessage({
        type: "success",
        message: "删除成功"
      });
    }
  });
};
const handleOpenInsert = () => {
  edit.value = {
    title: "新增代理",
    visible: true
  };
};

const handleOpenUpdate = (proxy: Proxy) => {
  editForm.value = clone(proxy);
  edit.value = {
    title: "修改代理",
    visible: true
  };
};

const handleReversalUpdate = (proxy: Proxy) => {
  console.log("更新", proxy);
  ipcRenderer.send("proxy.updateProxyStatus", {
    _id: proxy._id,
    status: !proxy.status
  });
};

const handleLoadLocalPorts = () => {
  loading.value.localPorts = 1;
  ipcRenderer.send("local.getLocalPorts");
};

const handleSelectLocalPort = useDebounceFn((port: number) => {
  editForm.value.localPort = port?.toString();
  handleCloseLocalPortDialog();
});

const handleCloseLocalPortDialog = () => {
  listPortsVisible.value = false;
};

const handleOpenLocalPortDialog = () => {
  listPortsVisible.value = true;
  handleLoadLocalPorts();
};

interface RestaurantItem {
  value: string;
}

const commonIp = ref<Array<RestaurantItem>>(commonIps);

const handleAutocompleteIP = (input: string) => {
  const parts = input.split(".").map(part => part.trim());

  const possibleIPs = [];
  // 根据输入的部分生成可能的 IP 地址
  if (parts.length === 1 && /^[0-9]{1,3}$/.test(parts[0])) {
    // 只有一个部分，例如 "192"
    for (let i = 0; i <= 255; i++) {
      possibleIPs.push({ value: `${parts[0]}.${i}.0.1` });
    }
  } else if (
    parts.length === 2 &&
    /^[0-9]{1,3}$/.test(parts[0]) &&
    /^[0-9]{1,3}$/.test(parts[1])
  ) {
    // 两个部分，例如 "192.168"
    for (let i = 0; i <= 255; i++) {
      possibleIPs.push({ value: `${parts[0]}.${parts[1]}.${i}.1` });
    }
  } else if (
    parts.length === 3 &&
    /^[0-9]{1,3}$/.test(parts[0]) &&
    /^[0-9]{1,3}$/.test(parts[1]) &&
    /^[0-9]{1,3}$/.test(parts[2])
  ) {
    // 三个部分，例如 "192.168.1"
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
    // 四个部分，例如 "192.168.1.1"
    possibleIPs.push({ value: input }); // 如果输入了完整的 IP，直接返回
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

onMounted(() => {
  handleInitHook();
  handleLoadProxys();
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Proxy.insertProxy.hook");
  ipcRenderer.removeAllListeners("Proxy.updateProxy.hook");
  ipcRenderer.removeAllListeners("Proxy.updateProxyStatus.hook");
  ipcRenderer.removeAllListeners("Proxy.deleteProxyById.hook");
  ipcRenderer.removeAllListeners("Proxy.getProxys.hook");
  ipcRenderer.removeAllListeners("local.getLocalPorts.hook");
});
</script>
<template>
  <!--  <coming-soon />-->
  <div class="main">
    <breadcrumb>
      <el-button class="mr-2" type="primary" @click="handleOpenInsert">
        <IconifyIconOffline icon="add" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb pr-2" v-loading="loading.list > 0">
      <template v-if="proxys && proxys.length > 0">
        <el-row :gutter="20">
          <el-col
            v-for="proxy in proxys"
            :key="proxy._id"
            :lg="6"
            :md="8"
            :sm="12"
            :xl="6"
            :xs="12"
            class="mb-[20px]"
          >
            <div class="bg-white w-full rounded drop-shadow-xl p-4">
              <div class="w-full flex justify-between">
                <div class="flex">
                  <div
                    class="w-12 h-12 rounded mr-4 flex justify-center items-center font-bold"
                    :class="proxy.type"
                  >
                    <span class="text-white text-sm">{{ proxy.type }}</span>
                  </div>
                  <div class="h-12 relative">
                    <div class="text-sm font-bold">
                      <span>{{ proxy.name }}</span>
                    </div>
                    <el-tag
                      v-if="!proxy.status"
                      class="mr-2"
                      type="danger"
                      size="small"
                      >已禁用
                    </el-tag>
                    <el-tag
                      v-if="
                        proxy.type === 'stcp' && proxy.stcpModel === 'visitors'
                      "
                      size="small"
                    >
                      访问者
                    </el-tag>
                    <el-tag
                      size="small"
                      v-if="
                        proxy.type === 'stcp' && proxy.stcpModel === 'visited'
                      "
                      >被访问者
                    </el-tag>
                    <!--                    <el-tag-->
                    <!--                      size="small"-->
                    <!--                      class="absolute bottom-0"-->
                    <!--                      type="success"-->
                    <!--                      effect="plain"-->
                    <!--                      >正常-->
                    <!--                    </el-tag>-->
                  </div>
                </div>
                <div class="flex items-start">
                  <el-dropdown size="small">
                    <a
                      href="javascript:void(0)"
                      class="text-xl text-[#ADADAD] hover:text-[#5A3DAA]"
                    >
                      <IconifyIconOffline icon="more-vert" />
                    </a>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleOpenUpdate(proxy)">
                          <IconifyIconOffline
                            icon="edit"
                            class="primary-text text-[14px]"
                          />
                          <span class="ml-1">修 改</span>
                        </el-dropdown-item>
                        <el-dropdown-item @click="handleReversalUpdate(proxy)">
                          <IconifyIconOffline
                            :icon="
                              proxy.status
                                ? 'switchAccessOutlineRounded'
                                : 'switchAccessRounded'
                            "
                            class="primary-text text-[14px]"
                            :class="
                              proxy.status ? 'text-red-500' : 'text-green-500'
                            "
                          />
                          <span class="ml-1">
                            {{ proxy.status ? "禁 用" : "启 用" }}
                          </span>
                        </el-dropdown-item>
                        <el-dropdown-item @click="handleDeleteProxy(proxy)">
                          <IconifyIconOffline
                            icon="delete-rounded"
                            class="text-red-500 text-[14px]"
                          />
                          <span class="ml-1">删 除</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="flex justify-between mt-4">
                <div
                  class="text-sm text-left"
                  v-if="proxy.type !== 'stcp' || proxy.stcpModel !== 'visitors'"
                >
                  <p class="text-[#ADADAD] font-bold">内网地址</p>
                  <p>{{ proxy.localIp }}</p>
                </div>

                <div class="text-sm text-center" v-if="proxy.type === 'tcp'">
                  <p class="text-[#ADADAD] font-bold">外网端口</p>
                  <p>{{ proxy.remotePort }}</p>
                </div>
                <div
                  class="text-sm text-center"
                  v-if="proxy.type !== 'stcp' || proxy.stcpModel !== 'visitors'"
                >
                  <p class="text-[#ADADAD] font-bold">内网端口</p>
                  <p>{{ proxy.localPort }}</p>
                </div>

                <div
                  class="text-sm text-center"
                  v-if="proxy.type === 'stcp' && proxy.stcpModel === 'visitors'"
                >
                  <p class="text-[#ADADAD] font-bold">访问者名称</p>
                  <p>{{ proxy.serverName }}</p>
                </div>

                <div
                  class="text-sm text-center"
                  v-if="proxy.type === 'stcp' && proxy.stcpModel === 'visitors'"
                >
                  <p class="text-[#ADADAD] font-bold">绑定地址</p>
                  <p>{{ proxy.bindAddr }}</p>
                </div>

                <div
                  class="text-sm text-center"
                  v-if="proxy.type === 'stcp' && proxy.stcpModel === 'visitors'"
                >
                  <p class="text-[#ADADAD] font-bold">绑定端口</p>
                  <p>{{ proxy.bindPort }}</p>
                </div>
              </div>
              <!--            <div class="text-sm text-[#ADADAD] py-2">本地地址 内网端口</div>-->
            </div>
          </el-col>
        </el-row>
      </template>
      <div
        v-else
        class="w-full h-full bg-white rounded p-2 overflow-hidden drop-shadow-xl flex justify-center items-center"
      >
        <el-empty description="暂无代理" />
      </div>
    </div>

    <el-dialog
      v-model="edit.visible"
      :title="edit.title"
      class="sm:w-[500px] md:w-[600px] lg:w-[800px]"
      top="5%"
      @close="editForm = defaultForm"
    >
      <el-form
        v-loading="loading.form"
        label-position="top"
        :model="editForm"
        :rules="editFormRules"
        ref="editFormRef"
      >
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="代理类型：" prop="type">
              <el-radio-group v-model="editForm.type">
                <el-radio-button
                  v-for="p in proxyTypes"
                  :key="p"
                  :label="p"
                  :value="p"
                />
              </el-radio-group>
            </el-form-item>
          </el-col>
          <template v-if="editForm.type === 'stcp'">
            <el-col :span="12">
              <el-form-item label="stcp模式：" prop="stcpModel">
                <el-radio-group v-model="editForm.stcpModel">
                  <el-radio
                    v-for="p in stcpModels"
                    :key="p.value"
                    :label="p.label"
                    :value="p.value"
                  />
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="共享密钥：" prop="secretKey">
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            对应参数：<span class="font-black text-[#5A3DAA]"
                              >secretKey</span
                            >
                            只有访问者与被访问者共享密钥一致的用户才能访问该服务
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
                      共享密钥：
                    </div>
                  </div>
                </template>
                <el-input
                  type="password"
                  v-model="editForm.secretKey"
                  placeholder="密钥"
                />
              </el-form-item>
            </el-col>
          </template>
          <el-col :span="editForm.stcpModel === 'visitors' ? 12 : 24">
            <el-form-item label="代理名称：" prop="name">
              <el-input
                v-model="editForm.name"
                placeholder="代理名称"
                clearable
              />
            </el-form-item>
          </el-col>
          <template
            v-if="
              editForm.type !== 'stcp' ||
              (editForm.type === 'stcp' && editForm.stcpModel === 'visited')
            "
          >
            <el-col :span="12">
              <el-form-item label="内网地址：" prop="localIp">
                <el-autocomplete
                  v-model="editForm.localIp"
                  :fetch-suggestions="handleIpFetchSuggestions"
                  clearable
                  placeholder="127.0.0.1"
                />
                <!--                <el-input-->
                <!--                  v-model="editForm.localIp"-->
                <!--                  placeholder="127.0.0.1"-->
                <!--                  clearable-->
                <!--                />-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                label="内网端口："
                prop="localPort"
                :rules="
                  editForm.type === 'tcp' || editForm.type === 'udp'
                    ? [
                        {
                          required: true,
                          message: `内网端口不能为空`,
                          trigger: 'blur'
                        },
                        {
                          pattern:
                            /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
                          message: '请输入正确的端口',
                          trigger: 'blur'
                        }
                      ]
                    : [
                        {
                          required: true,
                          message: `内网端口不能为空`,
                          trigger: 'blur'
                        },
                        {
                          pattern:
                            /^([0-5]?[0-9]{0,4}|6[0-4][0-9]{0,3}|65[0-5][0-9]?|655[0-2][0-9]?|6553[0-5])$/,
                          message: '请输入正确的端口',
                          trigger: 'blur'
                        }
                      ]
                "
              >
                <!--                <el-input-number-->
                <!--                  v-if="editForm.type === 'http' || editForm.type === 'https'"-->
                <!--                  placeholder="8080"-->
                <!--                  class="local-port-input"-->
                <!--                  :min="0"-->
                <!--                  :max="65535"-->
                <!--                  v-model="editForm.localPort"-->
                <!--                  controls-position="right"-->
                <!--                />-->
                <el-input
                  class="local-port-input"
                  placeholder="8080"
                  v-model="editForm.localPort"
                />
                <el-button
                  class="ml-[10px]"
                  plain
                  type="primary"
                  @click="handleOpenLocalPortDialog"
                >
                  <IconifyIconOffline
                    class="cursor-pointer mr-2"
                    icon="bring-your-own-ip-rounded"
                  />
                  内网端口
                </el-button>
              </el-form-item>
            </el-col>
          </template>
          <template v-if="editForm.type === 'tcp' || editForm.type === 'udp'">
            <el-col :span="8">
              <el-form-item label="外网端口：" prop="remotePort">
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
          <template
            v-if="editForm.type === 'http' || editForm.type === 'https'"
          >
            <el-col :span="24">
              <el-form-item
                v-for="(d, di) in editForm.customDomains"
                :key="'domain' + di"
                :label="di === 0 ? '自定义域名：' : ''"
                :prop="`customDomains.${di}`"
                :rules="[
                  {
                    required: true,
                    message: `自定义域名不能为空`,
                    trigger: 'blur'
                  },
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
                        <el-popover placement="top" trigger="hover">
                          <template #default>
                            对应参数：<span class="font-black text-[#5A3DAA]"
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
                      自定义域名：
                    </div>
                  </div>
                  <!--                  <el-popover-->
                  <!--                      placement="top"-->
                  <!--                      trigger="hover"-->
                  <!--                  >-->
                  <!--                    <template #default>-->
                  <!--                      对应参数：<span class="font-black text-[#5A3DAA]">customDomains</span>-->
                  <!--                    </template>-->
                  <!--                    <template #reference>-->
                  <!--                      <IconifyIconOffline class="text-base" color="#5A3DAA" icon="info"/>-->
                  <!--                    </template>-->
                  <!--                  </el-popover>-->
                  <!--                  <div class="flex items-center inin">-->
                  <!--                    <div class="h-full flex items-center mr-1">-->
                  <!--                      -->
                  <!--                    </div>-->
                  <!--                    <div>自定义域名：</div>-->
                  <!--                  </div>-->
                </template>
                <el-input
                  class="domain-input"
                  placeholder="github.com"
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
          <template
            v-if="editForm.type === 'stcp' && editForm.stcpModel === 'visitors'"
          >
            <el-col :span="12">
              <el-form-item label="被访问者代理名称：" prop="serverName">
                <el-input
                  type="text"
                  v-model="editForm.serverName"
                  placeholder="stcp被访问者代理名称"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="绑定地址：" prop="bindAddr">
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            对应参数：<span class="font-black text-[#5A3DAA]"
                              >bindAddr</span
                            >
                            要将被访问者的服务绑定到本地哪个<span
                              class="font-black text-[#5A3DAA]"
                              >IP</span
                            >
                            <br />
                            仅本机访问：<span class="font-black text-[#5A3DAA]"
                              >127.0.0.1</span
                            >
                            <br />
                            支持局域网其他设备访问：<span
                              class="font-black text-[#5A3DAA]"
                              >0.0.0.0</span
                            >
                            <br />
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
                      绑定地址：
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
              <el-form-item label="绑定端口：" prop="bindPort">
                <template #label>
                  <div class="inline-block">
                    <div class="flex items-center">
                      <div class="mr-1">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            对应参数：<span class="font-black text-[#5A3DAA]"
                              >bindAddr</span
                            >
                            要将被访问者的服务绑定到本地哪个<span
                              class="font-black text-[#5A3DAA]"
                              >端口</span
                            >
                            <br />
                            请自行确保端口未被占用
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
                      绑定端口：
                    </div>
                  </div>
                </template>
                <el-input-number
                  v-model="editForm.bindPort"
                  placeholder="8080"
                />
              </el-form-item>
            </el-col>
          </template>
          <el-col :span="24">
            <el-form-item>
              <div class="w-full flex justify-end">
                <el-button @click="edit.visible = false">
                  <iconify-icon-offline
                    class="cursor-pointer mr-2"
                    icon="cancel-presentation"
                  />
                  关 闭
                </el-button>
                <el-button plain type="primary" @click="handleSubmit">
                  <IconifyIconOffline
                    class="cursor-pointer mr-2"
                    icon="save-rounded"
                  />
                  保 存
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-dialog>

    <el-dialog v-model="listPortsVisible" title="内网端口" width="600" top="5%">
      <el-table
        :data="localPorts"
        stripe
        v-loading="loading.localPorts"
        border
        height="400"
      >
        <el-table-column label="协议" :width="60" prop="protocol" />
        <el-table-column label="IP" prop="ip" />
        <el-table-column label="端口" :width="80" prop="port" />
        <el-table-column label="操作" :width="80">
          <template #default="scope">
            <el-button
              type="text"
              @click="handleSelectLocalPort(scope.row.port)"
            >
              <IconifyIconOffline
                class="cursor-pointer mr-2"
                icon="gesture-select"
              />
              选择
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

.domain-input {
  width: calc(100% - 115px);
}

.local-port-input {
  width: calc(100% - 125px);
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
</style>
