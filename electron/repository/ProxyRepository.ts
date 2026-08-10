import Database from "better-sqlite3";
import BaseRepository, { SqlRow } from "./BaseRepository";

class ProxyRepository extends BaseRepository<FrpcProxy> {
  constructor(database: Database.Database) {
    super(database, "t_frpcd_proxies", [
      "id",
      "server_id",
      "name",
      "type",
      "local_ip",
      "local_port",
      "remote_port",
      "custom_domains_json",
      "locations_json",
      "host_header_rewrite",
      "visitors_model",
      "server_user",
      "server_name",
      "secret_key",
      "bind_addr",
      "bind_port",
      "subdomain",
      "basic_auth",
      "http_user",
      "http_password",
      "fallback_to",
      "fallback_timeout_ms",
      "https2http",
      "https2http_ca_file",
      "https2http_key_file",
      "keep_tunnel_open",
      "status",
      "transport_json"
    ]);
  }

  async updateProxyStatus(id: string, status: number): Promise<void> {
    this.database
      .prepare("UPDATE t_frpcd_proxies SET status = ? WHERE id = ?")
      .run(status, id);
  }

  protected toRow(proxy: FrpcProxy): SqlRow {
    return {
      id: proxy._id,
      server_id: "1",
      name: proxy.name ?? "",
      type: proxy.type,
      local_ip: proxy.localIP ?? "",
      local_port: String(proxy.localPort ?? "8080"),
      remote_port: String(proxy.remotePort ?? "8080"),
      custom_domains_json: JSON.stringify(proxy.customDomains ?? [""]),
      locations_json: JSON.stringify(proxy.locations ?? [""]),
      host_header_rewrite: proxy.hostHeaderRewrite ?? "",
      visitors_model: proxy.visitorsModel ?? "visitors",
      server_user: proxy.serverUser ?? "",
      server_name: proxy.serverName ?? "",
      secret_key: proxy.secretKey ?? "",
      bind_addr: proxy.bindAddr ?? "",
      bind_port: proxy.bindPort ?? null,
      subdomain: proxy.subdomain ?? "",
      basic_auth: proxy.basicAuth ? 1 : 0,
      http_user: proxy.httpUser ?? "",
      http_password: proxy.httpPassword ?? "",
      fallback_to: proxy.fallbackTo ?? "",
      fallback_timeout_ms: proxy.fallbackTimeoutMs ?? 500,
      https2http: proxy.https2http ? 1 : 0,
      https2http_ca_file: proxy.https2httpCaFile ?? "",
      https2http_key_file: proxy.https2httpKeyFile ?? "",
      keep_tunnel_open: proxy.keepTunnelOpen ? 1 : 0,
      status: proxy.status ?? 1,
      transport_json: JSON.stringify(proxy.transport ?? {})
    };
  }

  protected fromRow(row: SqlRow): FrpcProxy {
    return {
      _id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      localIP: String(row.local_ip),
      localPort: String(row.local_port),
      remotePort: String(row.remote_port),
      customDomains: JSON.parse(String(row.custom_domains_json)),
      locations: JSON.parse(String(row.locations_json)),
      hostHeaderRewrite: String(row.host_header_rewrite),
      visitorsModel: String(row.visitors_model),
      serverUser: String(row.server_user),
      serverName: String(row.server_name),
      secretKey: String(row.secret_key),
      bindAddr: String(row.bind_addr),
      bindPort: row.bind_port === null ? null : Number(row.bind_port),
      subdomain: String(row.subdomain),
      basicAuth: row.basic_auth === 1,
      httpUser: String(row.http_user),
      httpPassword: String(row.http_password),
      fallbackTo: String(row.fallback_to),
      fallbackTimeoutMs: Number(row.fallback_timeout_ms),
      https2http: row.https2http === 1,
      https2httpCaFile: String(row.https2http_ca_file),
      https2httpKeyFile: String(row.https2http_key_file),
      keepTunnelOpen: row.keep_tunnel_open === 1,
      status: Number(row.status),
      transport: JSON.parse(String(row.transport_json))
    };
  }
}

export default ProxyRepository;
