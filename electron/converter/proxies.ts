import BaseConverter from "../core/converter";

/**
 * Proxy converter
 */
export default class ProxiesConverter extends BaseConverter {
  public model2FrpcDesktopProxy(model: ProxiesModel): FrpcDesktopProxy {
    return {
      id: model.id,
      name: model.name,
      type: model.type,
      localIP: model.local_ip,
      localPort: model.local_port,
      remotePort: model.remote_port,
      customDomains: this.string2array(model.custom_domains),
      locations: this.string2array(model.locations),
      hostHeaderRewrite: model.host_header_rewrite,
      visitorsModel: model.visitors_model,
      serverName: model.server_name,
      secretKey: model.secret_key,
      bindAddr: model.bind_addr,
      bindPort: model.bind_port,
      subdomain: model.subdomain,
      basicAuth: Boolean(model.basic_auth),
      httpUser: model.http_user,
      httpPassword: model.http_password,
      fallbackTo: model.fallback_to,
      fallbackTimeoutMs: model.fallback_timeout_ms,
      https2http: Boolean(model.https2http),
      https2httpCaFile: model.https2http_crt_file,
      https2httpKeyFile: model.https2http_key_file,
      keepTunnelOpen: Boolean(model.keep_tunnel_open),
      transport: this.deserialization(model.transport),
      status: model.status ? 1 : 0
    };
  }

  public frpcDesktopProxy2Model(proxy: FrpcDesktopProxy): ProxiesModel {
    return {
      id: proxy.id,
      name: proxy.name,
      type: proxy.type,
      local_ip: proxy.localIP,
      local_port: proxy.localPort,
      remote_port: proxy.remotePort,
      custom_domains: this.array2string(proxy.customDomains),
      locations: this.array2string(proxy.locations),
      host_header_rewrite: proxy.hostHeaderRewrite,
      visitors_model: proxy.visitorsModel,
      server_name: proxy.serverName,
      secret_key: proxy.secretKey,
      bind_addr: proxy.bindAddr,
      bind_port: proxy.bindPort,
      subdomain: proxy.subdomain,
      basic_auth: proxy.basicAuth ? 1 : 0,
      http_user: proxy.httpUser,
      http_password: proxy.httpPassword,
      fallback_to: proxy.fallbackTo,
      fallback_timeout_ms: proxy.fallbackTimeoutMs,
      https2http: proxy.https2http ? 1 : 0,
      https2http_crt_file: proxy.https2httpCaFile,
      https2http_key_file: proxy.https2httpKeyFile,
      keep_tunnel_open: proxy.keepTunnelOpen ? 1 : 0,
      transport: this.serialization(proxy.transport),
      status: proxy.status ? 1 : 0
    };
  }
}
