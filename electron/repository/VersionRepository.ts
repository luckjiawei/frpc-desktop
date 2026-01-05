import "reflect-metadata"
import BaseRepository from "../core/repository";
import { inject, injectable } from "inversify";
import { TYPES } from "../di";
import knex from "knex";
/**
 * Repository for managing version information in the database
 */
@injectable()
export default class VersionRepository extends BaseRepository<VersionModel> {
  constructor(@inject(TYPES.Knex) knex: knex.Knex) {
    super(knex);
  }
  /**
   * Initialize the table schema
   * @protected
   */
  protected async initTableSchema() {
    await this.knex.schema.createTable(this.tableName(), table => {
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
   * Define the table name
   * @protected
   * @returns Table name string
   */
  protected tableName(): string {
    return "frpc_versions";
  }

  /**
   *
   * @param githubReleaseId
   * @returns Promise resolving to the version model or undefined
   */
  async findByGithubReleaseId(githubReleaseId: number): Promise<VersionModel> {
    if (!githubReleaseId) {
      return Promise.resolve(undefined);
    }
    return await this.table()
      .select("*")
      .where("github_release_id", "=", githubReleaseId)
      .first();
  }
}
