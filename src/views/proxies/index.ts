import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import { ref, computed, onMounted, reactive, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { IPCChannels } from "../../../electron/core/constant";
const defaultForm: FrpcDesktopProxy = {
    id: null,
    hostHeaderRewrite: "",
    locations: [""],
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
        useCompression: false,
        proxyProtocolVersion: ""
    }
};

export function useProxies() {
    const { t } = useI18n();
    const proxys = ref<Array<FrpcDesktopProxy>>([]);
    const loading = ref({
        list: 1,
        form: 0,
        localPorts: 1
    });

    const localPorts = ref<Array<LocalPort>>([]);
    const listPortsVisible = ref(false);

    const edit = ref({
        title: t("proxy.createTitle"),
        visible: false
    });
    const editForm = ref<FrpcDesktopProxy>(_.cloneDeep(defaultForm));

    const proxyTypes = ref([
        "http",
        "https",
        "tcp",
        "udp",
        "stcp",
        "xtcp",
        "sudp"
    ]);
    const currSelectLocalFileType = ref();
    const hasPlugin = ref(false);

    const frpcConfig = ref<FrpConfig>();
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
                pattern:
                    /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
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
                pattern:
                    /^(?:\d{1,5}|\d{1,5}-\d{1,5})(?:,(?:\d{1,5}|\d{1,5}-\d{1,5}))*$/,
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
                message: t(
                    "proxy.form.formItem.transportUseCompression.requireMessage"
                ),
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

    const handleAddLocation = () => {
        editForm.value.locations.push("");
    };

    const handleDeleteLocation = (index: number) => {
        editForm.value.locations.splice(index, 1);
    };

    const handleLoadProxies = () => {
        send(ipcRouters.PROXY.getAllProxies);
    };

    const handleLoadFrpcConfig = () => {
        send(ipcRouters.SERVER.getServerConfig);
    };

    const handleDeleteProxy = (proxy: FrpcDesktopProxy) => {
        send(ipcRouters.PROXY.deleteProxy, proxy.id);
        // ipcRenderer.send("proxy.deleteProxyById", proxy._id);
    };

    const handleResetForm = () => {
        editForm.value = _.cloneDeep(defaultForm);
    };

    const handleOpenInsert = () => {
        edit.value = {
            title: t("proxy.createTitle"),
            visible: true
        };
    };

    const handleOpenUpdate = (proxy: FrpcDesktopProxy) => {
        editForm.value = _.cloneDeep(proxy);
        // if (!editForm.value.fallbackTimeoutMs) {
        //   editForm.value.fallbackTimeoutMs = defaultForm.fallbackTimeoutMs;
        // }
        edit.value = {
            title: t("proxy.modifyTitle"),
            visible: true
        };
    };

    const handleReversalUpdate = (proxy: FrpcDesktopProxy) => {
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
        // });
    };

    onMounted(() => {
        handleLoadProxies();
        handleLoadFrpcConfig();

        on(IPCChannels.CONFIG_GET_SERVER_CONFIG, data => {
            if (data) {
                frpcConfig.value = data;
            }
        });

        on(IPCChannels.PROXY_GET_ALL_PROXIES, data => {
            loading.value.list--;
            proxys.value = data;
        });

        on(IPCChannels.SYSTEM_SELECT_LOCAL_FILE, data => {
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

        on(IPCChannels.PROXY_CREATE_PROXY, data => {
            insertOrUpdateHook(t("common.createSuccess"));
        });

        on(IPCChannels.PROXY_MODIFY_PROXY, data => {
            insertOrUpdateHook(t("common.modifySuccess"));
        });

        on(IPCChannels.PROXY_DELETE_PROXY, () => {
            handleLoadProxies();
            ElMessage({
                type: "success",
                message: t("common.deleteSuccess")
            });
        });

        on(IPCChannels.PROXY_MODIFY_PROXY_STATUS, () => {
            ElMessage({
                type: "success",
                message: t("common.modifySuccess")
            });
            // handleResetForm();
            handleLoadProxies();
            // edit.value.visible = false;
        });

        on(IPCChannels.PROXY_GET_LOCAL_PORTS, data => {
            loading.value.localPorts--;
            localPorts.value = data;
        });
    });

    const handleProxyTypeChange = e => {
        hasPlugin.value = false;
        if (e === "http" || e === "https" || e === "tcp" || e === "udp") {
            if (e === "https") {
                hasPlugin.value = true;
            }
            editForm.value.visitorsModel = "";
        } else {
            if (editForm.value.visitorsModel === "") {
                editForm.value.visitorsModel = "visitorsProvider";
            }
        }
    };

    onUnmounted(() => {
        removeRouterListeners(IPCChannels.PROXY_CREATE_PROXY);
        removeRouterListeners(IPCChannels.PROXY_MODIFY_PROXY);
        removeRouterListeners(IPCChannels.PROXY_DELETE_PROXY);
        removeRouterListeners(IPCChannels.PROXY_GET_ALL_PROXIES);
        removeRouterListeners(IPCChannels.PROXY_MODIFY_PROXY_STATUS);
        removeRouterListeners(IPCChannels.PROXY_GET_LOCAL_PORTS);
        removeRouterListeners(IPCChannels.SYSTEM_SELECT_LOCAL_FILE);
    });

    return {
        t
    };
}
