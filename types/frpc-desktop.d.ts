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
  status: number; // 0: disable 1: enable
};