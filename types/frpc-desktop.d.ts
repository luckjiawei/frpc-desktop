

interface FrpcDesktopSystemConfiguration {
  launchAtStartup: boolean;
  silentStartup: boolean;
  autoConnectOnStartup: boolean;
  language: string;
}

type FrpcDesktopServer = FrpcCommonConfig & {
  frpcVersion: number;
  multiuser: boolean;
  // system: any;
};

/**
 * frpc version
 */
type FrpcDesktopVersion ={
  id: number;
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
}

/**
 * opensource version config
 */
type OpenSourceFrpcDesktopConfiguration = FrpcDesktopServer & {
  id: number;
  system: FrpcDesktopSystemConfiguration;
};

type FrpcDesktopProxy = FrpcProxyConfig & {
  id: number;
  status: number; // 0: disable 1: enable
};
