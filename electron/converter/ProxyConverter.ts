import BaseConverter from "../core/BaseConverter"

export default class ProxyConverter extends BaseConverter{

    public model2FrpcDesktopProxy(model: ProxyModel): FrpcDesktopProxy {
        return null;
    }

    public frpcDesktopProxy2Model(proxy: FrpcDesktopProxy): ProxyModel {
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
            basic_auth: proxy.basicAuth,
            http_user: proxy.httpUser,
            http_password: proxy.httpPassword,
            fallback_to: proxy.fallbackTo,
            fallback_timeout_ms: proxy.fallbackTimeoutMs,
            https2http: proxy.https2http,
            https2http_crt_file: proxy.https2httpCaFile,
            https2http_key_file: proxy.https2httpKeyFile,
            keep_tunnel_open: proxy.keepTunnelOpen,
            transport: this.serialization(proxy.transport)
        };
    }


}