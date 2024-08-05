<script lang="ts" setup>
import {defineComponent, onMounted, onUnmounted, reactive, ref} from "vue";
import {ipcRenderer} from "electron";
import {ElMessage, ElMessageBox, FormInstance, FormRules} from "element-plus";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import {useDebounceFn} from "@vueuse/core";
import {clone} from "@/utils/clone";
import {Icon} from "@iconify/vue";

defineComponent({
  name: "Config"
});

type Config = {
  currentVersion: string;
  serverAddr: string;
  serverPort: number;
  authMethod: string;
  authToken: string;
  logLevel: string;
  logMaxDays: number;
  tlsConfigEnable: boolean;
  tlsConfigCertFile: string;
  tlsConfigKeyFile: string;
  tlsConfigTrustedCaFile: string;
  tlsConfigServerName: string;
  proxyConfigEnable: boolean;
  proxyConfigProxyUrl: string;
  systemSelfStart: boolean;
  systemStartupConnect: boolean;
  user: string;
  metaToken: string;
};

type Version = {
  id: string;
  name: string;
}

const formData = ref<Config>({
  currentVersion: "",
  serverAddr: "",
  serverPort: 7000,
  authMethod: "",
  authToken: "",
  logLevel: "info",
  logMaxDays: 3,
  tlsConfigEnable: false,
  tlsConfigCertFile: "",
  tlsConfigKeyFile: "",
  tlsConfigTrustedCaFile: "",
  tlsConfigServerName: "",
  proxyConfigEnable: false,
  proxyConfigProxyUrl: "",
  systemSelfStart: false,
  systemStartupConnect: false,
  user: "",
  metaToken: ""
});

const loading = ref(1);

const rules = reactive<FormRules>({
  currentVersion: [{required: true, message: "请选择版本", trigger: "blur"}],
  serverAddr: [
    {required: true, message: "请输入服务端地址", trigger: "blur"},
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: "请输入正确的服务端地址",
      trigger: "blur"
    }
  ],
  serverPort: [
    {required: true, message: "请输入服务器端口", trigger: "blur"}
  ],
  user: [
    {required: true, message: "请输入用户", trigger: "blur"}
  ],
  metaToken: [
    {required: true, message: "请输入多用户令牌", trigger: "blur"}
  ],
  authMethod: [{required: true, message: "请选择验证方式", trigger: "blur"}],
  authToken: [{required: true, message: "请输入 Token 值 ", trigger: "blur"}],
  logLevel: [{required: true, message: "请选择日志级别 ", trigger: "blur"}],
  logMaxDays: [{required: true, message: "请输入日志保留天数 ", trigger: "blur"}],
  tlsConfigEnable: [{required: true, message: "请选择 TLS 状态", trigger: "change"}],
  tlsConfigCertFile: [{required: true, message: "请选择 TLS 证书文件", trigger: "change"}],
  tlsConfigKeyFile: [{required: true, message: "请选择 TLS 密钥文件", trigger: "change"}],
  tlsConfigTrustedCaFile: [{required: true, message: "请选择 CA 证书文件", trigger: "change"}],
  tlsConfigServerName: [{required: true, message: "请输入 TLS Server 名称", trigger: "blur"}],
  proxyConfigEnable: [{required: true, message: "请选择代理状态", trigger: "change"}],
  proxyConfigProxyUrl: [
    {required: true, message: "请输入代理地址", trigger: "change"},
    {
      pattern: /^https?\:\/\/(\w+:\w+@)?([a-zA-Z0-9.-]+)(:\d+)?$/,
      message: "请输入正确的代理地址",
      trigger: "blur"
    }
  ],
  systemSelfStart: [
    {required: true, message: "请选择是否开机自启", trigger: "change"},
  ]
});

const versions = ref<Array<Version>>([]);

const formRef = ref<FormInstance>();
const handleSubmit = useDebounceFn(() => {
  if (!formRef.value) return;
  formRef.value.validate(valid => {
    if (valid) {
      loading.value = 1;
      const data = clone(formData.value);
      ipcRenderer.send("config.saveConfig", data);
    }
  });
}, 300);

const handleLoadVersions = () => {
  ipcRenderer.send("config.versions");
};

const handleAuthMethodChange = e => {
  if (e === 'multiuser') {
    ElMessageBox.alert("多用户插件需要 Frp版本 >= <span class=\"font-black text-[#5A3DAA]\">v0.31.0</span> 请自行选择正确版本", "提示", {
      // if you want to disable its autofocus
      autofocus: false,
      confirmButtonText: "知道了",
      dangerouslyUseHTMLString: true,
    })
  }
}

onMounted(() => {
  ipcRenderer.send("config.getConfig");
  handleLoadVersions();
  ipcRenderer.on("Config.getConfig.hook", (event, args) => {
    const {err, data} = args;
    if (!err) {
      if (data) {
        formData.value = data;
      }
    }
    loading.value--;
  });

  ipcRenderer.on("Config.saveConfig.hook", (event, args) => {
    ElMessage({
      type: "success",
      message: "保存成功"
    });
    loading.value--;
  });
  ipcRenderer.on("Config.versions.hook", (event, args) => {
    const {err, data} = args;
    if (!err) {
      versions.value = data;
    }
  });
});

const handleSelectFile = (type: number, ext: string[]) => {
  ipcRenderer.invoke("file.selectFile", ext).then(r => {
    switch (type) {
      case 1:
        formData.value.tlsConfigCertFile = r[0]
        break;
      case 2:
        formData.value.tlsConfigKeyFile = r[0]
        break;
      case 3:
        formData.value.tlsConfigTrustedCaFile = r[0]
        break;
    }
    console.log(r)

  })
}

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Config.getConfig.hook");
  ipcRenderer.removeAllListeners("Config.saveConfig.hook");
  ipcRenderer.removeAllListeners("Config.versions.hook");
});
</script>
<template>
  <div class="main">
    <breadcrumb/>
    <div class="app-container-breadcrumb pr-2" v-loading="loading > 0">
      <div
          class="w-full bg-white p-4 rounded drop-shadow-lg"
      >
        <el-form
            :model="formData"
            :rules="rules"
            label-position="right"
            ref="formRef"
            label-width="130"
        >
          <el-row :gutter="10">
            <el-col :span="24">
              <el-form-item label="选择版本：" prop="currentVersion">
                <el-select
                    v-model="formData.currentVersion"
                    class="w-full"
                    clearable
                >
                  <el-option
                      v-for="v in versions"
                      :key="v.id"
                      :label="v.name"
                      :value="v.id"
                  ></el-option>
                </el-select>
                <div class="w-full flex justify-end">
                  <el-link type="primary" @click="handleLoadVersions">
                    <Icon class="mr-1" icon="material-symbols:refresh-rounded"/>
                    手动刷新
                  </el-link>
                  <!--                  <el-button type="text" @click="handleLoadVersions">-->
                  <!--                    <Icon class="mr-1" icon="material-symbols:refresh-rounded"/>-->
                  <!--                    手动刷新-->
                  <!--                  </el-button>-->
                  <el-link class="ml-2" type="primary" @click="$router.replace({ name: 'Download' })">
                    <Icon class="mr-1" icon="material-symbols:download-2"/>
                    点击这里去下载
                  </el-link>
                  <!--                  <el-button-->
                  <!--                      type="text"-->
                  <!--                      @click="$router.replace({ name: 'Download' })"-->
                  <!--                  >-->
                  <!--                    <Icon class="mr-1" icon="material-symbols:download-2"/>-->
                  <!--                    点击这里去下载-->
                  <!--                  </el-button>-->
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">服务器配置</div>
            </el-col>
            <el-col :span="24">
              <el-form-item label="服务器地址：" prop="serverAddr">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        Frps服务端地址 <br/> 支持 <span class="font-black text-[#5A3DAA]">域名</span>、<span
                          class="font-black text-[#5A3DAA]">IP</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  服务器地址：
                </template>
                <el-input
                    v-model="formData.serverAddr"
                    placeholder="127.0.0.1"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="服务器端口：" prop="serverPort">
                <el-input-number
                    placeholder="7000"
                    v-model="formData.serverPort"
                    :min="0"
                    :max="65535"
                    controls-position="right"
                    class="!w-full"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="验证方式：" prop="authMethod">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        width="200"
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]">auth.method</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  验证方式：
                </template>
                <el-select
                    v-model="formData.authMethod"
                    placeholder="请选择验证方式"
                    @change="handleAuthMethodChange"
                    clearable
                >
                  <el-option label="令牌（token）" value="token"></el-option>
                  <el-option label="多用户" value="multiuser"></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24" v-if="formData.authMethod === 'token'">
              <el-form-item label="令牌：" prop="authToken">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        placement="top"
                        trigger="hover"
                        width="200"
                    >
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]">auth.token</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  令牌：
                </template>
                <el-input
                    placeholder="token"
                    type="password"
                    v-model="formData.authToken"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.authMethod === 'multiuser'">
              <el-form-item label="用户：" prop="user">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]">user</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  用户：
                </template>
                <el-input
                    placeholder="请输入用户"
                    v-model="formData.user"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.authMethod === 'multiuser'">
              <el-form-item label="用户令牌：" prop="metaToken">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        width="200"
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]">meta_token</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  用户令牌：
                </template>
                <el-input
                    placeholder="请输入用户令牌"
                    type="password"
                    v-model="formData.metaToken"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">TSL Config</div>
            </el-col>
            <el-col :span="24">
              <el-form-item label="是否启用TSL：" prop="tlsConfigEnable">
                <el-switch active-text="开"
                           inline-prompt
                           inactive-text="关"
                           v-model="formData.tlsConfigEnable"/>
              </el-form-item>
            </el-col>
            <template v-if="formData.tlsConfigEnable">
              <el-col :span="24">
                <el-form-item label="TLS证书文件：" prop="tlsConfigCertFile" label-width="180">
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover
                          width="260"
                          placement="top"
                          trigger="hover"
                      >
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]">transport.tls.certFile</span>
                        </template>
                        <template #reference>
                          <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                        </template>
                      </el-popover>
                    </div>
                    TLS 证书文件：
                  </template>
                  <el-input
                      class="button-input"
                      v-model="formData.tlsConfigCertFile"
                      placeholder="请选择TLS证书文件"
                      readonly
                  />
                  <el-button class="ml-2" type="primary" @click="handleSelectFile(1, ['crt'])">选择</el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="TLS密钥文件：" prop="tlsConfigKeyFile" label-width="180">
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover
                          width="260"
                          placement="top"
                          trigger="hover"
                      >
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]">transport.tls.keyFile</span>
                        </template>
                        <template #reference>
                          <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                        </template>
                      </el-popover>
                    </div>
                    TLS 密钥文件：
                  </template>
                  <el-input
                      class="button-input"
                      v-model="formData.tlsConfigKeyFile"
                      placeholder="请选择 TLS 密钥文件"
                      readonly
                  />
                  <el-button class="ml-2" type="primary" @click="handleSelectFile(2, ['key'])">选择</el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="CA证书文件：" prop="tlsConfigTrustedCaFile" label-width="180">
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover
                          width="310"
                          placement="top"
                          trigger="hover"
                      >
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]">transport.tls.trustedCaFile</span>
                        </template>
                        <template #reference>
                          <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                        </template>
                      </el-popover>
                    </div>
                    CA 证书文件：
                  </template>
                  <el-input
                      class="button-input"
                      v-model="formData.tlsConfigTrustedCaFile"
                      placeholder="请选择CA证书文件"
                      readonly
                  />
                  <el-button class="ml-2" type="primary" @click="handleSelectFile(3, ['crt'])">选择</el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="TLS Server 名称：" prop="tlsConfigServerName" label-width="180">
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover
                          width="300"
                          placement="top"
                          trigger="hover"
                      >
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]">transport.tls.serverName</span>
                        </template>
                        <template #reference>
                          <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                        </template>
                      </el-popover>
                    </div>
                    TLS Server 名称：
                  </template>
                  <el-input
                      v-model="formData.tlsConfigServerName"
                      placeholder="请输入TLS Server 名称"
                  />
                </el-form-item>
              </el-col>
            </template>
            <el-col :span="24">
              <div class="h2">代理</div>
            </el-col>
            <el-col :span="24">
              <el-form-item label="是否启动代理：" prop="proxyConfigEnable">
                <el-switch active-text="开"
                           inline-prompt
                           inactive-text="关"
                           v-model="formData.proxyConfigEnable"/>
              </el-form-item>
            </el-col>
            <template v-if="formData.proxyConfigEnable">
              <el-col :span="24">
                <el-form-item label="代理地址：" prop="proxyConfigProxyUrl">
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover
                          width="300"
                          placement="top"
                          trigger="hover"
                      >
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]">transport.proxyURL</span>
                        </template>
                        <template #reference>
                          <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                        </template>
                      </el-popover>
                    </div>
                    代理地址：
                  </template>
                  <el-input v-model="formData.proxyConfigProxyUrl"
                            placeholder="http://user:pwd@192.168.1.128:8080"/>
                </el-form-item>
              </el-col>
            </template>
            <el-col :span="24">
              <div class="h2">日志配置</div>
            </el-col>
            <el-col :span="12">
              <el-form-item class="!w-full" label="日志级别：" prop="logLevel">
                <el-select v-model="formData.logLevel">
                  <el-option label="info" value="info"/>
                  <el-option label="debug" value="debug"/>
                  <el-option label="waring" value="waring"/>
                  <el-option label="error" value="error"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="日志保留天数：" prop="logMaxDays">
                <el-input-number class="!w-full" controls-position="right" v-model="formData.logMaxDays"/>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">系统配置</div>
            </el-col>
            <el-col :span="12">
              <el-form-item label="开机自启：" prop="systemSelfStart">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        开机自动启动 <br/><span class="font-black text-[#5A3DAA]">Frpc Desktop</span>
                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  开机自启：
                </template>
                <el-switch active-text="开"
                           inline-prompt
                           inactive-text="关"
                           v-model="formData.systemSelfStart"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="自动连接：" prop="systemStartupConnect">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover
                        placement="top"
                        trigger="hover"
                    >
                      <template #default>
                        启动软件后是否<span class="font-black text-[#5A3DAA]">自动连接</span>服务器

                      </template>
                      <template #reference>
                        <Icon class="text-base" color="#5A3DAA" icon="material-symbols:info"/>
                      </template>
                    </el-popover>
                  </div>
                  自动连接：
                </template>
                <el-switch active-text="开"
                           inline-prompt
                           inactive-text="关"
                           v-model="formData.systemStartupConnect"/>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item>
                <el-button plain type="primary" @click="handleSubmit">
                  <Icon class="mr-1" icon="material-symbols:save"/>
                  保 存
                </el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>

.h2 {
  color: #5A3DAA;
  font-size: 16px;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
  font-weight: 700;
  padding: 6px 10px 6px 15px;
  border-left: 5px solid #5A3DAA;
  border-radius: 4px;
  background-color: #EEEBF6;
  margin-bottom: 18px;
}

.button-input {
  width: calc(100% - 68px);
}
</style>
