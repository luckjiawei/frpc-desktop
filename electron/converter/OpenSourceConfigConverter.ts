import BaseConverter from "../core/converter";
import { TomlValue } from "smol-toml";

export default class OpenSourceConfigConverter extends BaseConverter {
  /**
   * biz config to model
   * @param c biz config data
   * @returns model data
   */
  public openSourceConfig2Model(
    c: OpenSourceFrpcDesktopConfiguration
  ): OpenSourceConfigModel {
    const r: OpenSourceConfigModel = {
      id: c.id,
      user: c.user,
      server_addr: c.serverAddr,
      server_port: c.serverPort,
      login_fail_exit: c.loginFailExit,
      log: super.serialization(c.log),
      auth: super.serialization(c.auth),
      web_server: super.serialization(c.webServer),
      transport: super.serialization(c.transport),
      udp_packet_size: c.udpPacketSize,
      metadatas: super.serialization(c.metadatas),

      frpc_version: c.frpcVersion,
      multiuser: c.multiuser,

      launch_at_startup: c.system.launchAtStartup,
      silent_startup: c.system.silentStartup,
      auto_connect_on_startup: c.system.autoConnectOnStartup,
      language: c.system.language
    };
    return r;
  }

  public model2OpenSourceConfig(
    m: OpenSourceConfigModel
  ): OpenSourceFrpcDesktopConfiguration {
    return {
      id: m.id,
      user: m.user,
      serverAddr: m.server_addr,
      serverPort: m.server_port,
      loginFailExit: m.login_fail_exit,
      log: super.deserialization(m.log),
      auth: super.deserialization(m.auth),
      webServer: m.web_server ? super.deserialization(m.web_server) : null,
      transport: super.deserialization(m.transport),
      udpPacketSize: m.udp_packet_size,
      metadatas: super.deserialization(m.metadatas),
      frpcVersion: m.frpc_version,
      multiuser: m.multiuser,
      system: {
        launchAtStartup: m.launch_at_startup,
        silentStartup: m.silent_startup,
        autoConnectOnStartup: m.auto_connect_on_startup,
        language: m.language
      }
    };
  }

  public tomlValue2Model(tv: TomlValue): OpenSourceConfigModel {
    return null;
  }
}
