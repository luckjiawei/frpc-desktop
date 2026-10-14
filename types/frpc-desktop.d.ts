type FrpcDesktopProxy = FrpcProxyConfig & {};

interface FrpcProcessStatus {
  running: boolean;
  connectionError: string | null;
  lastStartTime?: number;
}

/** launch/getOverview：启动页仪表盘的只读摘要（不含任何密钥） */
interface FrpcHomeOverview {
  serverAddr: string;
  serverPort: number;
  protocol: string;
  tlsEnable: boolean;
  webServerEnable: boolean;
  webServerPort: number;
  frpcVersion: string | null;
  customFrpcPath: boolean;
  proxyTotal: number;
  proxyEnabled: number;
  recentLogs: string[];
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
};

type OpenSourceFrpcDesktopServer = FrpcDesktopServer & {
  system: FrpcSystemConfiguration;
};

type FrpcProxy = BaseEntity &
  FrpcProxyConfig & {
    status: number; // 0: disable 1: enable
  };
