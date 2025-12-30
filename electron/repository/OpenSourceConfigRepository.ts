import BaseRepository from "../core/BaseRepository";
/**
 * Repository for managing open source configuration in the database
 */
export default class OpenSourceConfigRepository extends BaseRepository<OpenSourceConfigModel> {
  constructor() {
    super();
  }

  /**
   * Get the table name
   * @returns Table name string
   */
  protected tableName() {
    return "frpc_opensource_config";
  }

  /**
   * Initialize the table schema
   * @protected
   */
  protected initTableSchema() {
    this.db.schema
      .hasTable("frpc_opensource_config")
      .then(exist => {
        if (exist) return;
        this.db.schema.createTable("frpc_opensource_config", table => {
          table.bigIncrements("id", { primaryKey: true });

          /**
           * frp configuration
           */
          table.bigint("frpc_version");
          table.boolean("multiuser");
          table.string("user");
          table.string("server_addr");
          table.string("server_port");
          table.string("login_fail_exit");
          table.json("log");
          table.json("auth");
          table.json("web_server");
          table.json("transport");
          table.bigint("udp_packet_size");
          table.json("metadatas");

          /**
           * frpc desktop configuration
           */
          table.boolean("launch_at_startup");
          table.boolean("silent_startup");
          table.boolean("auto_connect_on_startup");
          table.string("language");
          table.timestamps(true, true);
        });
      })
      .catch(error => {
        // Ignore errors during table creation
      });
  }
}
