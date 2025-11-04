import BaseRepository from "./BaseRepository";
import knex from "knex";
import Logger from "../core/Logger";

class ProxyRepository extends BaseRepository<ProxyModel> {
  constructor(db: knex.Knex) {
    super(db);
  }

  protected tableName() {
    return "frpc_proxies";
  }

  protected initTableSchema() {
    this.db.schema.hasTable(this.tableName()).then(exist => {
      if (exist) return;
      Logger.info(
        `FrpcDesktopApp.initializeDatabase`,
        `creating proxies table schema.`
      );
      return this.db.schema.createTable(this.tableName(), table => {
        table.bigIncrements("id", { primaryKey: true });
        table.string("name");
        table.string("type");
        table.string("localIP");
        table.integer("localPort");
        table.integer("remotePort");
        table.json("customDomains");
        table.json("locations");
        table.string("hostHeaderRewrite");
        table.string("visitorsModel");
        table.string("serverName");
        table.string("secretKey");
        table.string("bindAddr");
        table.integer("bindPort");
        table.string("subdomain");
        table.boolean("basicAuth");
        table.string("httpUser");
        table.string("httpPassword");
        table.string("fallbackTo");
        table.integer("fallbackTimeoutMs");
        table.boolean("https2http");
        table.string("https2httpCaFile");
        table.string("https2httpKeyFile");
        table.boolean("keepTunnelOpen");
        table.json("transport");
        table.timestamps(true, true);
      });
    });
  }

  updateProxyStatus(id: number, status: number): Promise<void> {
    return this.db
      .table(this.tableName())
      .where("id", "=", id)
      .update({ status: status });
  }
}

export default ProxyRepository;
