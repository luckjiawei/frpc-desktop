use crate::models::FrpcVersion;
use rusqlite::{params, Connection, OptionalExtension, Result};
use uuid::Uuid;

pub struct VersionRepository;

impl VersionRepository {
    pub fn get_downloaded_versions(conn: &Connection) -> Result<Vec<FrpcVersion>> {
        let mut stmt = conn.prepare(
            "SELECT id, github_release_id, github_asset_id, github_created_at,
                    name, asset_name, version_download_count, asset_download_count,
                    browser_download_url, downloaded, local_path, size
             FROM t_frpcd_versions ORDER BY github_created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let github_release_id: i64 = row.get(1)?;
            let github_asset_id: i64 = row.get(2)?;
            let github_created_at: String = row.get(3)?;
            let name: String = row.get(4)?;
            let asset_name: String = row.get(5)?;
            let version_download_count: i64 = row.get(6)?;
            let asset_download_count: i64 = row.get(7)?;
            let browser_download_url: String = row.get(8)?;
            let downloaded_int: i64 = row.get(9)?;
            let local_path: Option<String> = row.get(10)?;
            let size: String = row.get(11)?;

            Ok(FrpcVersion {
                id,
                github_release_id,
                github_asset_id,
                github_created_at,
                name,
                asset_name,
                version_download_count,
                asset_download_count,
                browser_download_url,
                downloaded: downloaded_int == 1,
                local_path,
                size,
            })
        })?;

        let mut versions = Vec::new();
        for r in rows {
            if let Ok(v) = r {
                versions.push(v);
            }
        }
        Ok(versions)
    }

    pub fn find_by_github_release_id(
        conn: &Connection,
        release_id: i64,
    ) -> Result<Option<FrpcVersion>> {
        let mut stmt = conn.prepare(
            "SELECT id, github_release_id, github_asset_id, github_created_at,
                    name, asset_name, version_download_count, asset_download_count,
                    browser_download_url, downloaded, local_path, size
             FROM t_frpcd_versions WHERE github_release_id = ?",
        )?;

        stmt.query_row(params![release_id], |row| {
            let id: String = row.get(0)?;
            let github_release_id: i64 = row.get(1)?;
            let github_asset_id: i64 = row.get(2)?;
            let github_created_at: String = row.get(3)?;
            let name: String = row.get(4)?;
            let asset_name: String = row.get(5)?;
            let version_download_count: i64 = row.get(6)?;
            let asset_download_count: i64 = row.get(7)?;
            let browser_download_url: String = row.get(8)?;
            let downloaded_int: i64 = row.get(9)?;
            let local_path: Option<String> = row.get(10)?;
            let size: String = row.get(11)?;

            Ok(FrpcVersion {
                id,
                github_release_id,
                github_asset_id,
                github_created_at,
                name,
                asset_name,
                version_download_count,
                asset_download_count,
                browser_download_url,
                downloaded: downloaded_int == 1,
                local_path,
                size,
            })
        })
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
                browser_download_url, downloaded, local_path, size
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(github_release_id) DO UPDATE SET
                github_asset_id = excluded.github_asset_id,
                name = excluded.name,
                asset_name = excluded.asset_name,
                downloaded = excluded.downloaded,
                local_path = excluded.local_path,
                size = excluded.size",
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
