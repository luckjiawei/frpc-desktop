type FrpcDesktopProxy = FrpcProxyConfig & {};

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
    frpcVersion: number;
    multiuser: boolean;
    name: string;
    remark: string;
    isDefault: boolean;
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
};

type OpenSourceFrpcDesktopServer = FrpcDesktopServer & {
  system: FrpcSystemConfiguration;
};

type FrpcProxy = BaseEntity & FrpcProxyConfig & {
  serverId: string;
  status: number; // 0: disable 1: enable
};

type ProxyReachabilityState =
  | "online"
  | "offline"
  | "disabled"
  | "unknown";

type ProxyReachabilityResult = {
  proxyId: string;
  proxyName: string;
  proxyRemark: string;
  serverId: string;
  target: string;
  state: ProxyReachabilityState;
  statusCode?: number;
  elapsedMs: number;
  message: string;
  checkedAt: number;
};

type ExternalFrpcProcessInfo = {
  pid: number;
  processName: string;
  command: string;
  cwd: string | null;
  configPath: string | null;
};

type FrpcServerRuntimeStatus = {
  serverId: string;
  name: string;
  remark: string;
  serverAddr: string;
  serverPort: number;
  isDefault: boolean;
  running: boolean;
  pid: number | null;
  configPath: string;
  logPath: string;
  connectionError: string | null;
};
