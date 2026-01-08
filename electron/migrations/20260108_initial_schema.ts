import type { Knex } from "knex";

/**
 * Initial migration to create all tables
 * @param knex Knex instance
 */
export async function up(knex: Knex): Promise<void> {
  // Create frpc_opensource_config table
  await knex.schema.createTable("frpc_opensource_config", table => {
    table.bigIncrements("id", { primaryKey: true });
    // frp configuration
    table.bigint("frpc_version");
    table.boolean("multiuser");
    table.string("user");
    table.string("server_addr");
    table.integer("server_port");
    table.string("login_fail_exit");
    table.json("log");
    table.json("auth");
    table.json("web_server");
    table.json("transport");
    table.bigint("udp_packet_size");
    table.json("metadatas");
    // frpc desktop configuration
    table.boolean("launch_at_startup");
    table.boolean("silent_startup");
    table.boolean("auto_connect_on_startup");
    table.string("language");
    table.timestamps(true, true);
  });

  // Create frpc_proxies table
  await knex.schema.createTable("frpc_proxies", table => {
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

  // Create frpc_versions table
  await knex.schema.createTable("frpc_versions", table => {
    table.bigIncrements("id", { primaryKey: true });
    table.bigint("github_release_id");
    table.bigint("github_asset_id");
    table.string("github_created_at");
    table.string("name");
    table.string("asset_name");
    table.bigint("version_download_count");
    table.bigint("asset_download_count");
    table.string("browser_download_url");
    table.boolean("downloaded");
    table.string("local_path");
    table.string("size");
    table.timestamps(true, true);
  });
}

/**
 * Rollback migration - drop all tables
 * @param knex Knex instance
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("frpc_versions");
  await knex.schema.dropTableIfExists("frpc_proxies");
  await knex.schema.dropTableIfExists("frpc_opensource_config");
}
