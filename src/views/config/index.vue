<script lang="ts" setup>
import {defineComponent, onMounted, onUnmounted, reactive, ref} from "vue";
import {ipcRenderer} from "electron";
import {ElMessage, FormInstance, FormRules} from "element-plus";
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
  // authMethod: [{ required: true, message: "请选择验证方式", trigger: "blur" }],
  authToken: [{required: true, message: "请输入token值 ", trigger: "blur"}],
  logLevel: [{required: true, message: "请选择日志级别 ", trigger: "blur"}],
  logMaxDays: [{required: true, message: "请输入日志保留天数 ", trigger: "blur"}],
  tlsConfigEnable: [{required: true, message: "请选择TLS状态", trigger: "change"}],
  tlsConfigCertFile: [{required: true, message: "请选择TLS证书文件", trigger: "change"}],
  tlsConfigKeyFile: [{required: true, message: "请选择TLS密钥文件", trigger: "change"}],
  tlsConfigTrustedCaFile: [{required: true, message: "请选择CA证书文件", trigger: "change"}],
  tlsConfigServerName: [{required: true, message: "请输入TLS Server名称", trigger: "blur"}]
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
            label-width="140"
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
                <el-select
                    v-model="formData.authMethod"
                    placeholder="请选择验证方式"
                    clearable
                >
                  <el-option label="token" value="token"></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24" v-if="formData.authMethod === 'token'">
              <el-form-item label="token：" prop="authToken">
                <el-input
                    placeholder="token"
                    type="password"
                    v-model="formData.authToken"
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
                <el-form-item label="TLS证书文件：" prop="tlsConfigCertFile">
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
                <el-form-item label="TLS密钥文件：" prop="tlsConfigKeyFile">
                  <el-input
                      class="button-input"
                      v-model="formData.tlsConfigKeyFile"
                      placeholder="请选择TLS密钥文件"
                      readonly
                  />
                  <el-button class="ml-2" type="primary" @click="handleSelectFile(2, ['key'])">选择</el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="CA证书文件：" prop="tlsConfigTrustedCaFile">
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
                <el-form-item label="TLS Server名称：" prop="tlsConfigServerName">
                  <el-input
                      v-model="formData.tlsConfigServerName"
                      placeholder="请输入TLS Server名称"
                  />
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
