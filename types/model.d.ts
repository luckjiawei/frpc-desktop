interface BaseModel {
  id: number;
}

/**
 * proxy model
 */
type ProxyModel = BaseModel & {
  name: string;
  type: string;
  localIP: string;
  localPort: any;
  remotePort: any;
  customDomains: string; // string array
  locations: string; // string array
  hostHeaderRewrite: string;
  visitorsModel: string;
  serverName: string;
  secretKey: string;
  bindAddr: string;
  bindPort: number;
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
  transport: string; // json
};

/**
 * frps version model
 */
type VersionModel = BaseModel & {
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

/**
 * opensource config model
 */
type OpenSourceConfigModel = BaseModel & {
  user: string;
  serverAddr: string;
  serverPort: number;
  loginFailExit: boolean;
  log: string; // json
  auth: string; // json
  webServer: string; // json
  transport: string; // json
  udpPacketSize: number;
  metadatas: string; // json

  frpcVersion: number;
  multiuser: boolean;

  launchAtStartup: boolean;
  silentStartup: boolean;
  autoConnectOnStartup: boolean;
  language: string;
};
