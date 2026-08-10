import Database from "better-sqlite3";
import BaseRepository, { SqlRow } from "./BaseRepository";

class VersionRepository extends BaseRepository<FrpcVersion> {
  constructor(database: Database.Database) {
    super(database, "t_frpcd_versions", [
      "id",
      "github_release_id",
      "github_asset_id",
      "github_created_at",
      "name",
      "asset_name",
      "version_download_count",
      "asset_download_count",
      "browser_download_url",
      "downloaded",
      "local_path",
      "size"
    ]);
  }

  async findByGithubReleaseId(githubReleaseId: number): Promise<FrpcVersion> {
    const row = this.database
      .prepare("SELECT * FROM t_frpcd_versions WHERE github_release_id = ?")
      .get(githubReleaseId) as SqlRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  async exists(githubReleaseId: number): Promise<boolean> {
    const result = this.database
      .prepare(
        `SELECT EXISTS(
           SELECT 1 FROM t_frpcd_versions WHERE github_release_id = ?
         ) AS found`
      )
      .get(githubReleaseId) as { found: number };
    return result.found === 1;
  }

  protected toRow(version: FrpcVersion): SqlRow {
    return {
      id: version._id,
      github_release_id: version.githubReleaseId,
      github_asset_id: version.githubAssetId,
      github_created_at: version.githubCreatedAt,
      name: version.name,
      asset_name: version.assetName,
      version_download_count: version.versionDownloadCount ?? 0,
      asset_download_count: version.assetDownloadCount ?? 0,
      browser_download_url: version.browserDownloadUrl,
      downloaded: version.downloaded ? 1 : 0,
      local_path: version.localPath ?? null,
      size: version.size ?? ""
    };
  }

  protected fromRow(row: SqlRow): FrpcVersion {
    return {
      _id: String(row.id),
      githubReleaseId: Number(row.github_release_id),
      githubAssetId: Number(row.github_asset_id),
      githubCreatedAt: String(row.github_created_at),
      name: String(row.name),
      assetName: String(row.asset_name),
      versionDownloadCount: Number(row.version_download_count),
      assetDownloadCount: Number(row.asset_download_count),
      browserDownloadUrl: String(row.browser_download_url),
      downloaded: row.downloaded === 1,
      localPath: row.local_path === null ? null : String(row.local_path),
      size: String(row.size)
    };
  }
}

export default VersionRepository;
