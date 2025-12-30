type FrpcDesktopProxy = FrpcProxyConfig & {};

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

type FrpcVersion = VersionModel & {};

type OpenSourceFrpcDesktopConfiguration = FrpcDesktopServer & {
  system: FrpcDesktopSystemConfiguration;
};

type FrpcDesktopProxy = FrpcProxyConfig & {
  id: number;
  status: number; // 0: disable 1: enable
};
