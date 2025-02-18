type LogConfig = {
  to: string;
  level: string;
  maxDays: number;
  disablePrintColor: boolean;
};

type AuthConfig = {
  method: string;
  token: string;
};

type WebServerConfig = {
  addr: string;
  port: number;
  user: string;
  password: string;
  pprofEnable: boolean;
};

type TransportConfig = {
  poolCount: number;
  protocol: string;
  connectServerLocalIP: string;
};

interface FrpcCommonConfig {
  user: string;
  serverAddr: string;
  serverPort: number;
  loginFailExit: boolean;
  log: LogConfig;
  auth: AuthConfig;
  webServer: WebServerConfig;
  transport: TransportConfig;
  udpPacketSize: number;
  // metadatas: MetadataConfig;
}

interface FrpcProxyConfig {
  name: string;
  type: string;
  localIP: string;
  localPort: number;
  remotePort: number;
}
