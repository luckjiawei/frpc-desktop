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

type TransportTlsConfig = {
  enable: boolean;
  certFile: string;
  keyFile: string;
  trustedCaFile: string;
  serverName: string;
  disableCustomTLSFirstByte: boolean;
};

type TransportConfig = {
  dialServerTimeout: number;
  dialServerKeepalive: number;
  poolCount: number;
  tcpMux: boolean;
  tcpMuxKeepaliveInterval: number;
  protocol: string;
  connectServerLocalIP: string;
  proxyURL: string;
  tls: TransportTlsConfig;
  heartbeatInterval: number;
  heartbeatTimeout: number;
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
  metadatas: Record<string, any>;
}

interface FrpcProxyConfig {
  name: string;
  type: string;
  localIP: string;
  localPort: any;
  remotePort: any;
  customDomains: string[];
  locations: string[];
  hostHeaderRewrite: string;
  stcpModel: string;
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
}
