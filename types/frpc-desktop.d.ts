type FrpcDesktopProxy = FrpcProxyConfig & {};

type TunnelProvider = "frpc" | "cloudflared";

/** 隧道实例（t_frpcd_tunnels）；默认实例 id 为 "1"，始终是 frpc */
interface Tunnel {
  id: string;
  name: string;
  provider: TunnelProvider;
  autoStart: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** tunnel/list：实例列表项（不含任何密钥） */
interface TunnelSummary extends Tunnel {
  /** 必填配置是否已填写（frpc 服务端地址 / cloudflared 令牌） */
  configured: boolean;
  /** 仅 frpc；cloudflared 实例为空 */
  serverAddr: string;
  serverPort: number;
  proxyTotal: number;
  proxyEnabled: number;
}

/** tunnel:status 事件与 launch/getStatus(es) 返回的运行状态 */
interface TunnelStatus {
  tunnelId: string;
  provider: string;
  running: boolean;
  connectionError: string | null;
  lastStartTime: number | null;
}

/** cloudflared 实例配置（t_frpcd_cloudflared_tunnels），远程管理（令牌）模式 */
interface CloudflaredSettings {
  tunnelId: string;
  cloudflaredVersion: number | null;
  customCloudflaredPath: string;
  token: string;
  protocol: "auto" | "quic" | "http2";
  edgeIpVersion: "auto" | "4" | "6";
  logLevel: "debug" | "info" | "warn" | "error";
}

interface BaseEntity {
  _id: string;
}

interface FrpcSystemConfiguration {
  launchAtStartup: boolean;
  silentStartup: boolean;
  autoConnectOnStartup: boolean;
  language: string;
}

type FrpcDesktopServer = BaseEntity &
  FrpcCommonConfig & {
    frpcVersion: number | null;
    customFrpcPath?: string;
    multiuser: boolean;
    // system: any;
  };

type FrpcVersion = BaseEntity & {
  githubReleaseId: number;
  githubAssetId: number;
  githubCreatedAt: string;
  name: string;
  assetName: string;
  versionDownloadCount: number;
  assetDownloadCount: number;
  browserDownloadUrl: string;
  downloaded: boolean;
  localPath: string;
  size: string;
  provider: TunnelProvider;
};

type OpenSourceFrpcDesktopServer = FrpcDesktopServer & {
  system: FrpcSystemConfiguration;
};

type FrpcProxy = BaseEntity &
  FrpcProxyConfig & {
    /** 所属隧道实例 id */
    serverId?: string;
    status: number; // 0: disable 1: enable
  };
