import Database from "better-sqlite3";
import AppConfigRepository from "./AppConfigRepository";
import BaseRepository, { SqlRow } from "./BaseRepository";

class ServerRepository extends BaseRepository<OpenSourceFrpcDesktopServer> {
  constructor(
    database: Database.Database,
    private readonly appConfigRepository: AppConfigRepository
  ) {
    super(database, "t_frpcd_servers", [
      "id",
      "frpc_version",
      "multiuser",
      "user",
      "server_addr",
      "server_port",
      "login_fail_exit",
      "udp_packet_size",
      "auth_json",
      "log_json",
      "web_server_json",
      "transport_json",
      "metadatas_json"
    ]);
  }

  async insert(server: OpenSourceFrpcDesktopServer) {
    return this.updateById("1", server);
  }

  async insertMany(servers: OpenSourceFrpcDesktopServer[]) {
    if (servers.length > 1) {
      throw new Error("Only one server configuration is supported.");
    }
    if (servers.length === 1) {
      await this.updateById("1", servers[0]);
    }
    return servers;
  }

  async updateById(
    id: string,
    server: OpenSourceFrpcDesktopServer
  ): Promise<OpenSourceFrpcDesktopServer> {
    if (id !== "1") {
      throw new Error("Only server id 1 is supported.");
    }
    server._id = id;
    this.database.transaction(() => this.upsertForMigration(server))();
    return server;
  }

  async findById(id: string): Promise<OpenSourceFrpcDesktopServer> {
    const server = await super.findById(id);
    if (server) {
      server.system = this.appConfigRepository.getSystemConfig();
    }
    return server;
  }

  async findAll(): Promise<OpenSourceFrpcDesktopServer[]> {
    const servers = await super.findAll();
    const system = this.appConfigRepository.getSystemConfig();
    servers.forEach(server => {
      server.system = system;
    });
    return servers;
  }

  async truncate(): Promise<void> {
    this.database.transaction(() => {
      this.database.prepare("DELETE FROM t_frpcd_servers").run();
      this.database
        .prepare("DELETE FROM t_frpcd_app_config WHERE namespace = 'desktop'")
        .run();
    })();
  }

  exists(id: string): Promise<boolean> {
    const result = this.database
      .prepare(
        "SELECT EXISTS(SELECT 1 FROM t_frpcd_servers WHERE id = ?) AS found"
      )
      .get(id) as { found: number };
    return Promise.resolve(result.found === 1);
  }

  public upsertForMigration(server: OpenSourceFrpcDesktopServer): void {
    server._id = "1";
    super.upsertForMigration(server);
    this.appConfigRepository.saveSystemConfig(server.system);
  }

  protected toRow(server: OpenSourceFrpcDesktopServer): SqlRow {
    return {
      id: "1",
      frpc_version: server.frpcVersion ?? null,
      multiuser: server.multiuser ? 1 : 0,
      user: server.user ?? "",
      server_addr: server.serverAddr ?? "",
      server_port: server.serverPort ?? 7000,
      login_fail_exit: server.loginFailExit ? 1 : 0,
      udp_packet_size: server.udpPacketSize ?? 1500,
      auth_json: JSON.stringify(server.auth ?? {}),
      log_json: JSON.stringify(server.log ?? {}),
      web_server_json: JSON.stringify(server.webServer ?? {}),
      transport_json: JSON.stringify(server.transport ?? {}),
      metadatas_json: JSON.stringify(server.metadatas ?? {})
    };
  }

  protected fromRow(row: SqlRow): OpenSourceFrpcDesktopServer {
    return {
      _id: String(row.id),
      frpcVersion: row.frpc_version === null ? null : Number(row.frpc_version),
      multiuser: row.multiuser === 1,
      user: String(row.user),
      serverAddr: String(row.server_addr),
      serverPort: Number(row.server_port),
      loginFailExit: row.login_fail_exit === 1,
      udpPacketSize: Number(row.udp_packet_size),
      auth: JSON.parse(String(row.auth_json)),
      log: JSON.parse(String(row.log_json)),
      webServer: JSON.parse(String(row.web_server_json)),
      transport: JSON.parse(String(row.transport_json)),
      metadatas: JSON.parse(String(row.metadatas_json)),
      system: this.appConfigRepository.getSystemConfig()
    };
  }
}

export default ServerRepository;
