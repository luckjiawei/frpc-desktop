import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseRepository from "../core/repository";
import { TYPES } from "../di";
import knex from "knex";

/**
 * Repository for managing proxy configurations in the database
 */
@injectable()
export default class ProxiesRepository extends BaseRepository<ProxiesModel> {
  constructor(@inject(TYPES.Knex) knex: knex.Knex) {
    super(knex);
  }

  /**
   * Get the table name
   * @returns Table name string
   */
  protected tableName() {
    return "frpc_proxies";
  }

  /**
   * Initialize the table schema
   * @protected
   */
  protected async initTableSchema() {
    await this.knex.schema.createTable(this.tableName(), table => {
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
      table.string("https2http_crt_file");
      table.string("https2http_key_file");
      table.boolean("keep_tunnel_open");
      table.json("transport");
      table.boolean("status");
      table.timestamps(true, true);
    });
  }

  /**
   * Update proxy status by ID
   * @param id Proxy ID
   * @param status New status value
   * @returns Promise that resolves when update is complete
   */
  updateProxyStatus(id: number, status: number): Promise<void> {
    return this.knex
      .table(this.tableName())
      .where("id", "=", id)
      .update({ status: status });
  }
}
