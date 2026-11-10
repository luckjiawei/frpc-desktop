use crate::models::FrpcVersion;
use rusqlite::{params, Connection, OptionalExtension, Result, Row};
use uuid::Uuid;

pub struct VersionRepository;

const SELECT_COLUMNS: &str = "SELECT id, github_release_id, github_asset_id, github_created_at,
        name, asset_name, version_download_count, asset_download_count,
        browser_download_url, downloaded, local_path, size, provider
 FROM t_frpcd_versions";

impl VersionRepository {
    fn map_row(row: &Row) -> Result<FrpcVersion> {
        Ok(FrpcVersion {
            id: row.get(0)?,
            github_release_id: row.get(1)?,
            github_asset_id: row.get(2)?,
            github_created_at: row.get(3)?,
            name: row.get(4)?,
            asset_name: row.get(5)?,
            version_download_count: row.get(6)?,
            asset_download_count: row.get(7)?,
            browser_download_url: row.get(8)?,
            downloaded: row.get::<_, i64>(9)? == 1,
            local_path: row.get(10)?,
            size: row.get(11)?,
            provider: row.get(12)?,
        })
    }

    /// Downloaded binaries of every provider; callers filter by `provider`.
    pub fn get_downloaded_versions(conn: &Connection) -> Result<Vec<FrpcVersion>> {
        let mut stmt = conn.prepare(&format!(
            "{} ORDER BY github_created_at DESC",
            SELECT_COLUMNS
        ))?;
        let rows = stmt.query_map([], Self::map_row)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_downloaded_versions_by_provider(
        conn: &Connection,
        provider: &str,
    ) -> Result<Vec<FrpcVersion>> {
        let mut stmt = conn.prepare(&format!(
            "{} WHERE provider = ?1 ORDER BY github_created_at DESC",
            SELECT_COLUMNS
        ))?;
        let rows = stmt.query_map(params![provider], Self::map_row)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn find_by_github_release_id(
        conn: &Connection,
        release_id: i64,
    ) -> Result<Option<FrpcVersion>> {
        conn.query_row(
            &format!("{} WHERE github_release_id = ?1", SELECT_COLUMNS),
            params![release_id],
            Self::map_row,
        )
        .optional()
    }

    pub fn save_version(conn: &Connection, mut version: FrpcVersion) -> Result<FrpcVersion> {
        if version.id.is_empty() {
            version.id = Uuid::new_v4().to_string();
        }
        conn.execute(
            "INSERT INTO t_frpcd_versions (
                id, github_release_id, github_asset_id, github_created_at,
                name, asset_name, version_download_count, asset_download_count,
                browser_download_url, downloaded, local_path, size, provider
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(github_release_id) DO UPDATE SET
                github_asset_id = excluded.github_asset_id,
                name = excluded.name,
                asset_name = excluded.asset_name,
                downloaded = excluded.downloaded,
                local_path = excluded.local_path,
                size = excluded.size,
                provider = excluded.provider",
            params![
                version.id,
                version.github_release_id,
                version.github_asset_id,
                version.github_created_at,
                version.name,
                version.asset_name,
                version.version_download_count,
                version.asset_download_count,
                version.browser_download_url,
                if version.downloaded { 1 } else { 0 },
                version.local_path,
                version.size,
                version.provider,
            ],
        )?;
        Ok(version)
    }

    pub fn delete_by_github_release_id(conn: &Connection, release_id: i64) -> Result<()> {
        conn.execute(
            "DELETE FROM t_frpcd_versions WHERE github_release_id = ?",
            params![release_id],
        )?;
        Ok(())
    }
}
