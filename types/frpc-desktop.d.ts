type FrpcDesktopProxy = FrpcProxyConfig & {};

interface BaseEntity {
  _id: string;
};

interface FrpcSystemConfiguration {
  launchAtStartup: boolean;
  silentStartup: boolean;
  autoConnectOnStartup: boolean;
}

type FrpcDesktopServer = FrpcCommonConfig & {
  frpcVersion: number;
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