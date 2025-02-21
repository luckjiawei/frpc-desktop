import VersionDao from "../dao/VersionDao";
import BaseService from "./BaseService";
import GitHubService from "./GitHubService";
import FileService from "./FileService";
import frpReleasesJson from "../json/frp-releases.json";
import { download } from "electron-dl";
import { BrowserWindow } from "electron";
import GlobalConstant from "../core/GlobalConstant";
import path from "path";
import fs from "fs";
import FileUtils from "../utils/FileUtils";
import SecureUtils from "../utils/SecureUtils";
import PathUtils from "../utils/PathUtils";

/**
 * arch mapping
 */
const versionMapping = {
  win32_x64: ["window", "amd64"],
  win32_arm64: ["window", "arm64"],
  win32_ia32: ["window", "386"],
  darwin_arm64: ["darwin", "arm64"],
  darwin_x64: ["darwin", "amd64"],
  darwin_amd64: ["darwin", "amd64"],
  linux_x64: ["linux", "amd64"],
  linux_arm64: ["linux", "arm64"]
};

class VersionService extends BaseService<FrpcVersion> {
  private readonly _versionDao: VersionDao;
  private readonly _fileService: FileService;
  private readonly _gitHubService: GitHubService;
  private readonly _currFrpArch: Array<string>;
  private versions: Array<FrpcVersion> = [];

  constructor(
    versionDao: VersionDao,
    fileService: FileService,
    gitHubService: GitHubService
  ) {
    super();
    this._versionDao = versionDao;
    this._gitHubService = gitHubService;
    this._fileService = fileService;
    const nodeVersion = `${process.platform}_${process.arch}`;
    this._currFrpArch = versionMapping[nodeVersion];
  }

  downloadFrpVersion(githubReleaseId: number, onProgress: Function) {
    return new Promise((resolve, reject) => {
      const version = this.versions.find(
        f => f.githubReleaseId === githubReleaseId
      );
      if (!version) {
        reject(new Error("version not found"));
      }
      const url = version.browserDownloadUrl;
      const downloadedFilePath = path.join(
        PathUtils.getDownloadStoragePath(),
        `${version.assetName}`
      );

      const versionFilePath = path.join(
        PathUtils.getVersionStoragePath(),
        SecureUtils.calculateMD5(version.name)
      );

      // const targetPath = path.resolve();
      download(BrowserWindow.getFocusedWindow(), url, {
        filename: `${version.assetName}`,
        directory: PathUtils.getDownloadStoragePath(),
        onProgress: progress => {
          onProgress(progress);
        },
        onCompleted: () => {
          if (fs.existsSync(versionFilePath)) {
            fs.rmSync(versionFilePath, { recursive: true, force: true });
          }
          const ext = path.extname(version.assetName);
          if (ext === GlobalConstant.ZIP_EXT) {
            this._fileService.decompressZipFile(
              downloadedFilePath,
              versionFilePath
            );
          } else if (
            ext === GlobalConstant.GZ_EXT &&
            version.assetName.includes(GlobalConstant.TAR_GZ_EXT)
          ) {
            this._fileService.decompressTarGzFile(
              downloadedFilePath,
              versionFilePath
            );
          }
          version.localPath = versionFilePath;
          this._versionDao.insert(version).then(data => {
            resolve(data);
          });
        }
      });
    });
  }

  deleteFrpVersion() {}

  getFrpVersionsByGitHub(): Promise<Array<FrpcVersion>> {
    return new Promise<Array<FrpcVersion>>((resolve, reject) => {
      this._gitHubService
        .getGithubRepoAllReleases("fatedier/frp")
        .then((releases: Array<GithubRelease>) => {
          const versions: Array<FrpcVersion> =
            this.githubRelease2FrpcVersion(releases);
          this.versions = versions;
          resolve(versions);
        })
        .catch(err => reject(err));
    });
  }

  getFrpVersionByLocalJson(): Promise<Array<FrpcVersion>> {
    return new Promise<Array<FrpcVersion>>(resolve => {
      const versions = this.githubRelease2FrpcVersion(frpReleasesJson);
      resolve(versions);
    });
  }

  getFrpVersion() {}

  private findCurrentArchitectureAsset(assets: Array<GithubAsset>) {
    return assets.find((af: GithubAsset) => {
      return this._currFrpArch.every(item => af.name.includes(item));
    });
  }

  private githubRelease2FrpcVersion(
    releases: Array<GithubRelease>
  ): Array<FrpcVersion> {
    return releases
      .filter(release => {
        return this.findCurrentArchitectureAsset(release.assets);
      })
      .map(m => {
        const asset = this.findCurrentArchitectureAsset(m.assets);
        // m.assets.forEach((ma: GithubAsset) => {
        //   // if (asset) {
        //   // const absPath = path.join(
        //   //   frpPath,
        //   //   asset.name.replace(/(\.tar\.gz|\.zip)$/, "")
        //   // );
        //   // m.absPath = absPath;
        //   // m.download_completed = fs.existsSync(absPath);
        //   m.download_count = download_count;
        //   m.size = formatBytes(ma.size);
        //   // }
        // });
        // const asset = getAdaptiveAsset(m.id);
        const download_count = m.assets.reduce(
          (sum, item) => sum + item.download_count,
          0
        );

        const v: FrpcVersion = {
          githubReleaseId: m.id,
          githubAssetId: asset.id,
          githubCreatedAt: asset.created_at,
          name: m.name,
          assetName: asset.name,
          versionDownloadCount: download_count,
          assetDownloadCount: asset.download_count,
          browserDownloadUrl: asset.browser_download_url,
          downloaded: false,
          localPath: "",
          size: FileUtils.formatBytes(asset.size)
        };

        return v;
      });
  }

  // private async frpcVersionExists(githubReleaseId: number): boolean {
  //   const version = await this._versionDao.findByGithubReleaseId(
  //     githubReleaseId
  //   );
  //
  //   if (version) {
  //     return fs.existsSync(version.localPath);
  //   }
  //   return false;
  // }
}

export default VersionService;
