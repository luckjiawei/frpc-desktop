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
        localPort: any;
        remotePort: string;
        customDomains: string[];
        stcpModel: string;
        serverName: string;
        secretKey: string;
        bindAddr: string;
        bindPort: number;
        status: boolean;
        subdomain: string;
        basicAuth: boolean;
        httpUser: string;
        httpPassword: string;
        fallbackTo: string;
        fallbackTimeoutMs: number;
        https2http: boolean;
        https2httpCaFile: string;
        https2httpKeyFile: string;
        keepTunnelOpen: boolean;
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
        size: string;
        download_count: number;
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
        systemSilentStartup: boolean;
        user: string;
        metaToken: string;
        transportHeartbeatInterval: number;
        transportHeartbeatTimeout: number;
        webEnable: boolean;
        webPort: number;
        transportProtocol: string;
        transportDialServerTimeout: number;
        transportDialServerKeepalive: number;
        transportPoolCount: number;
        transportTcpMux: boolean;
        transportTcpMuxKeepaliveInterval: number;
    };

    type GitHubMirror = {
        id: string;
        name: string;
    }


}
export {};