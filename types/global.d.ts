declare module 'element-plus/dist/locale/zh-cn.mjs' {
    const zhLocale: any;
    export default zhLocale;
}

declare module 'element-plus/dist/locale/en.mjs' {
    const enLocale: any;
    export default enLocale;
}

declare global {

    /**
     * 代理配置类型
     */
    type Proxy = {
        _id: string;
        name: string;
        type: string;
        localIp: string;
        localPort: number;
        remotePort: number;
        customDomains: string[];
        stcpModel: string;
        serverName: string;
        secretKey: string;
        bindAddr: string;
        bindPort: number;
    };

    /**
     * 本地端口类型
     */
    type LocalPort = {
        protocol: string;
        ip: string;
        port: number;
    }

    /**
     * 版本类型
     */
    type FrpVersion = {
        id: number;
        name: string;
        published_at: string;
        download_completed: boolean;
        absPath: string;
        assets: Asset[]
    };

    /**
     * 全局配置
     */
    type FrpConfig = {
        currentVersion: number;
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
        transportHeartbeatInterval: number;
        transportHeartbeatTimeout: number;
    };


}
export {};