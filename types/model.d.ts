interface BaseModel {
  id: number;
}

/**
 * proxy model
 */
type ProxiesModel = BaseModel & {
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
  basic_auth: number;
  http_user: string;
  http_password: string;
  fallback_to: string;
  fallback_timeout_ms: number;
  https2http: number;
  https2http_crt_file: string;
  https2http_key_file: string;
  keep_tunnel_open: number;
  transport: string; // json
  status: number;
};

/**
 * frps version model
 */
type VersionModel = BaseModel & {
  github_release_id: number;
  github_asset_id: number;
  github_created_at: string;
  name: string;
  asset_name: string;
  version_download_count: number;
  asset_download_count: number;
  browser_download_url: string;
  downloaded: number;
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
  login_fail_exit: number;
  log: string; // json
  auth: string; // json
  web_server: string; // json
  transport: string; // json
  udp_packet_size: number;
  metadatas: string; // json

  frpc_version: number;
  multiuser: number;

  // system: string; // json
  launch_at_startup: number;
  silent_startup: number;
  auto_connect_on_startup: number;
  language: string;
};

type MigrationModel = BaseModel & {
  version: number;
  version_no: number;
}