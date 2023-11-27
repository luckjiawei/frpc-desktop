<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref, reactive } from "vue";
import { ipcRenderer } from "electron";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useDebounceFn } from "@vueuse/core";
import { clone } from "@/utils/clone";
import { Icon } from "@iconify/vue";

defineComponent({
  name: "Config"
});

type Config = {
  currentVersion: string;
  serverAddr: string;
  serverPort: number;
  authMethod: string;
  authToken: string;
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
  authToken: ""
});

const loading = ref(1);

const rules = reactive<FormRules>({
  currentVersion: [{ required: true, message: "请选择版本", trigger: "blur" }],
  serverAddr: [
    { required: true, message: "请输入服务端地址", trigger: "blur" },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: "请输入正确的服务端地址",
      trigger: "blur"
    }
  ],
  serverPort: [
    { required: true, message: "请输入服务器端口", trigger: "blur" }
  ],
  // authMethod: [{ required: true, message: "请选择验证方式", trigger: "blur" }],
  authToken: [{ required: true, message: "请输入token值 ", trigger: "blur" }]
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
    const { err, data } = args;
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
    const { err, data } = args;
    if (!err) {
      versions.value = data;
    }
  });
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Config.getConfig.hook");
  ipcRenderer.removeAllListeners("Config.saveConfig.hook");
  ipcRenderer.removeAllListeners("Config.versions.hook");
});
</script>
<template>
  <div>
    <breadcrumb />
    <div
      class="w-full bg-white p-4 rounded drop-shadow-lg"
      v-loading="loading > 0"
    >
      <el-form
        :model="formData"
        :rules="rules"
        label-position="right"
        ref="formRef"
        label-width="120"
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
                <el-button type="text" @click="handleLoadVersions">
                  <Icon class="mr-1" icon="material-symbols:refresh-rounded" />
                  手动刷新
                </el-button>
                <el-button
                  type="text"
                  @click="$router.replace({ name: 'Download' })"
                >
                  <Icon class="mr-1" icon="material-symbols:download-2" />
                  点击这里去下载
                </el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="服务端地址：" prop="serverAddr">
              <el-input
                v-model="formData.serverAddr"
                placeholder="127.0.0.1"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="服务端端口：" prop="serverPort">
              <el-input-number
                placeholder="7000"
                v-model="formData.serverPort"
                :min="0"
                :max="65535"
                controls-position="right"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="24">
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
            <el-form-item>
              <el-button plain type="primary" @click="handleSubmit">
                <Icon class="mr-1" icon="material-symbols:save" />
                保 存
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
