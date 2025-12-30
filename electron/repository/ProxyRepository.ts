import BaseRepository from "../core/BaseRepository";

/**
 * Repository for managing proxy configurations in the database
 */
export default class ProxyRepository extends BaseRepository<ProxyModel> {
  constructor() {
    super();
  }

  /**
   * Get the table name
   * @returns Table name string
   */
  protected tableName() {
    return "frpc_proxy";
  }

  /**
   * Initialize the table schema
   * @protected
   */
  protected initTableSchema() {
    this.db.schema.hasTable(this.tableName()).then(exist => {
      if (exist) return;
      return this.db.schema.createTable(this.tableName(), table => {
        table.bigIncrements("id", { primaryKey: true });
        table.string("name");
        table.string("type");
        table.string("local_ip");
        table.string("local_port");
        table.string("remote_port");
        table.json("custom_domains");
        table.json("locations");
        table.string("host_header_rewrite");
        table.string("visitors_model");
        table.string("server_name");
        table.string("secret_key");
        table.string("bind_addr");
        table.string("bind_port");
        table.string("subdomain");
        table.boolean("basic_auth");
        table.string("http_user");
        table.string("http_password");
        table.string("fallback_to");
        table.integer("fallback_timeout_ms");
        table.boolean("https2http");
        table.string("https2http_ca_file");
        table.string("https2http_key_file");
        table.boolean("keep_tunnel_open");
        table.json("transport");
        table.timestamps(true, true);
      });
    });
  }

  /**
   * Update proxy status by ID
   * @param id Proxy ID
   * @param status New status value
   * @returns Promise that resolves when update is complete
   */
  updateProxyStatus(id: number, status: number): Promise<void> {
    return this.db
      .table(this.tableName())
      .where("id", "=", id)
      .update({ status: status });
  }
}