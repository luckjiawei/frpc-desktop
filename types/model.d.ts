interface BaseModel {
  id: number;
}

/**
 * proxy model
 */
type ProxyModel = BaseModel & {
  name: string;
  type: string;
  local_ip: string;
  local_port: any;
  remote_port: any;
  custom_domains: string; // string array
  locations: string; // string array
  host_header_rewrite: string;
  visitors_model: string;
  server_name: string;
  secret_key: string;
  bind_addr: string;
  bind_port: number;
  subdomain: string;
  basic_auth: boolean;
  http_user: string;
  http_password: string;
  fallback_to: string;
  fallback_timeout_ms: number;
  https2http: boolean;
  https2http_crt_file: string;
  https2http_key_file: string;
  keep_tunnel_open: boolean;
  transport: string; // json
};

/**
 * frps version model
 */
type VersionModel = BaseModel & {
  github_Release_Id: number;
  github_asset_id: number;
  github_created_at: string;
  name: string;
  asset_name: string;
  version_download_count: number;
  asset_download_count: number;
  browser_download_url: string;
  downloaded: boolean;
  local_path: string;
  size: string;
};

/**
 * opensource config model
 */
type OpenSourceConfigModel = BaseModel & {
  user: string;
  server_addr: string;
  server_port: number;
  login_fail_exit: boolean;
  log: string; // json
  auth: string; // json
  web_server: string; // json
  transport: string; // json
  udp_packet_size: number;
  metadatas: string; // json

  frpc_version: number;
  multiuser: boolean;

  // system: string; // json
  launch_at_startup: boolean;
  silent_startup: boolean;
  auto_connect_on_startup: boolean;
  language: string;
};
