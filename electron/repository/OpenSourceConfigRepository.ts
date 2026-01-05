import "reflect-metadata"
import BaseRepository from "../core/repository";
import { inject } from "inversify";
import { TYPES } from "../di";
import knex from "knex";
import log from "electron-log/main";
/**
 * Repository for managing open source configuration in the database
 */

export default class OpenSourceConfigRepository extends BaseRepository<OpenSourceConfigModel> {
  constructor(@inject(TYPES.Knex) knex: knex.Knex) {
    super(knex);
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
  protected async initTableSchema() {
    try {
      await this.knex.schema.createTable(this.tableName(), table => {
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
    } catch (e) {
      log.scope("repository").error("Failed to create table", e);
    }
  }

  /**
   * Update language by primary key
   * @param id primary key
   * @param language language value
   * @returns Number of affected rows
   */
  public updateLanguageById(id: number, language: string): Promise<number> {
    if (id === undefined || id === null) return Promise.resolve(0);
    return this.table().update({ language }).where("id", "=", id);
  }
}
