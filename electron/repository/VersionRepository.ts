import BaseRepository from "../core/BaseRepository";

/**
 * Repository for managing version information in the database
 */
export default class VersionRepository extends BaseRepository<VersionModel> {
  constructor() {
    super();
  }
  /**
   * Initialize the table schema
   * @protected
   */
  protected initTableSchema() {
    this.db.schema.hasTable("frpc_version").then(exist => {
      if (exist) return;
      return this.db.schema.createTable("frpc_version", table => {
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
  findByGithubReleaseId(githubReleaseId: number): Promise<VersionModel> {
    return this.table()
      .select("*")
      .where("githubReleaseId", "=", githubReleaseId)
      .first();
  }
}
