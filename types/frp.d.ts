/**
 * FRP log configuration
 */
type LogConfig = {
  to: string;
  level: string;
  maxDays: number;
  disablePrintColor: boolean;
};

/**
 * FRP authentication configuration
 */
type AuthConfig = {
  method: string;
  token: string;
};

/**
 * FRP web server configuration
 */
type WebServerConfig = {
  addr: string;
  port: number;
  user: string;
  password: string;
  pprofEnable: boolean;
};

/**
 * FRP transport TLS configuration
 */
type TransportTlsConfig = {
  enable: boolean;
  certFile: string;
  keyFile: string;
  trustedCaFile: string;
  serverName: string;
  disableCustomTLSFirstByte: boolean;
};

/**
 * FRP transport configuration
 */
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

/**
 * FRP common configuration
 */
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

/**
 * FRP proxy transport configuration
 */
interface FrpcProxyTransportConfig {
  useEncryption: boolean;
  useCompression: boolean;
  proxyProtocolVersion: string;
}

/**
 * FRP proxy configuration
 */
interface FrpcProxyConfig {
  name: string;
  type: string;
  localIP: string;
  localPort: any;
  remotePort: any;
  customDomains: string[];
  locations: string[];
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
  transport: FrpcProxyTransportConfig;
}
