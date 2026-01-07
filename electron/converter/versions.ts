import BaseConverter from "../core/converter";

export default class VersionConverter extends BaseConverter {


    public frpcDesktopVersion2Model(source: FrpcDesktopVersion): VersionModel {
        return {
            id: source.id,
            github_release_id: source.githubReleaseId,
            github_asset_id: source.githubAssetId,
            github_created_at: source.githubCreatedAt,
            name: source.name,
            asset_name: source.assetName,
            version_download_count: source.versionDownloadCount,
            asset_download_count: source.assetDownloadCount,
            browser_download_url: source.browserDownloadUrl,
            downloaded: source.downloaded ? 1 : 0,
            local_path: source.localPath,
            size: source.size,
        };
    }

    public model2FrpcDesktopVersion(source: VersionModel) {
        const r: FrpcDesktopVersion = {
            id: source.id,
            githubReleaseId: source.github_release_id,
            githubAssetId: source.github_asset_id,
            githubCreatedAt: source.github_created_at,
            name: source.name,
            assetName: source.asset_name,
            versionDownloadCount: source.version_download_count,
            assetDownloadCount: source.asset_download_count,
            browserDownloadUrl: source.browser_download_url,
            downloaded: source.downloaded ? true : false,
            localPath: source.local_path,
            size: source.size,
        };
        return r;
    }

}
