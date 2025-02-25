import VersionRepository from "../repository/VersionRepository";
import BaseService from "./BaseService";
import GitHubService from "./GitHubService";
import frpReleasesJson from "../json/frp-releases.json";
import { download } from "electron-dl";
import { BrowserWindow, dialog } from "electron";
import GlobalConstant from "../core/GlobalConstant";
import path from "path";
import fs from "fs";
import SecureUtils from "../utils/SecureUtils";
import PathUtils from "../utils/PathUtils";
import FileUtils from "../utils/FileUtils";
import frpChecksums from "../json/frp_all_sha256_checksums.json";
import SystemService from "./SystemService";

class VersionService extends BaseService<FrpcVersion> {
  private readonly _versionDao: VersionRepository;
  private readonly _systemService: SystemService;
  private readonly _gitHubService: GitHubService;
  private readonly _currFrpArch: Array<string>;
  private _versions: Array<FrpcVersion> = [];

  constructor(
    versionDao: VersionRepository,
    systemService: SystemService,
    gitHubService: GitHubService
  ) {
    super();
    this._versionDao = versionDao;
    this._gitHubService = gitHubService;
    this._systemService = systemService;
    const nodeVersion = `${process.platform}_${process.arch}`;
    this._currFrpArch = GlobalConstant.FRP_ARCH_VERSION_MAPPING[nodeVersion];
  }

  downloadFrpVersion(githubReleaseId: number, onProgress: Function) {
    return new Promise((resolve, reject) => {
      const version = this._versions.find(
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

      if (fs.existsSync(versionFilePath)) {
        fs.rmSync(versionFilePath, { recursive: true, force: true });
      }
      // const targetPath = path.resolve();
      download(BrowserWindow.getFocusedWindow(), url, {
        filename: `${version.assetName}`,
        directory: PathUtils.getDownloadStoragePath(),
        onProgress: progress => {
          onProgress(progress);
        },
        onCompleted: () => {
          this.decompressFrp(version, downloadedFilePath)
            .then(data => {
              resolve(data);
            })
            .catch(err => {
              reject(err);
            });
        }
      });
    });
  }

  async deleteFrpVersion(githubReleaseId: number) {
    if (!githubReleaseId) {
      return;
    }
    const version = await this._versionDao.findByGithubReleaseId(
      githubReleaseId
    );
    if (this.frpcVersionExists(version)) {
      fs.rmSync(version.localPath, { recursive: true, force: true });
      await this._versionDao.deleteById(version._id);
    }
  }

  async getFrpVersionsByGitHub(): Promise<Array<FrpcVersion>> {
    return new Promise<Array<FrpcVersion>>((resolve, reject) => {
      this._gitHubService
        .getGithubRepoAllReleases("fatedier/frp")
        .then(async (releases: Array<GithubRelease>) => {
          const versions: Array<FrpcVersion> =
            await this.githubRelease2FrpcVersion(releases);
          // const _versions: Array<FrpcVersion> = (this._versions = _versions);
          this._versions = versions;
          resolve(versions);
        })
        .catch(err => reject(err));
    });
  }

  async getFrpVersionByLocalJson(): Promise<Array<FrpcVersion>> {
    return this.githubRelease2FrpcVersion(frpReleasesJson);
  }

  getFrpVersion() {}

  private findCurrentArchitectureAsset(assets: Array<GithubAsset>) {
    return assets.find((af: GithubAsset) => {
      return this._currFrpArch.every(item => af.name.includes(item));
    });
  }

  private async githubRelease2FrpcVersion(
    releases: Array<GithubRelease>
  ): Promise<Array<FrpcVersion>> {
    const allVersions = await this._versionDao.findAll();
    return releases
      .filter(release => {
        // only support toml version.
        return release.id > 124395282;
      })
      .filter(release => {
        return this.findCurrentArchitectureAsset(release.assets);
      })
      .map(m => {
        const asset = this.findCurrentArchitectureAsset(m.assets);
        const download_count = m.assets.reduce(
          (sum, item) => sum + item.download_count,
          0
        );

        const currVersion = allVersions.find(ff => ff.githubReleaseId === m.id);
        const v: FrpcVersion = {
          _id: "",
          githubReleaseId: m.id,
          githubAssetId: asset.id,
          githubCreatedAt: asset.created_at,
          name: m.name,
          assetName: asset.name,
          versionDownloadCount: download_count,
          assetDownloadCount: asset.download_count,
          browserDownloadUrl: asset.browser_download_url,
          downloaded: this.frpcVersionExists(currVersion),
          localPath: currVersion && currVersion.localPath,
          size: FileUtils.formatBytes(asset.size)
        };
        return v;
      });
  }

  private frpcVersionExists(version: FrpcVersion): boolean {
    // const version = await this._versionDao.findByGithubReleaseId(
    //   githubReleaseId
    // );

    if (version) {
      return fs.existsSync(version.localPath);
    }
    return false;
  }

  async importLocalFrpcVersion(win: BrowserWindow) {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
      ]
    });
    if (result.canceled) {
      return;
    } else {
      const filePath = result.filePaths[0];
      const checksum = FileUtils.calculateFileChecksum(filePath);
      const frpName = frpChecksums[checksum];
      if (frpName) {
        if (this._currFrpArch.every(item => frpName.includes(item))) {
          const version = this.getFrpVersionByAssetName(frpName);
          const existsVersion = await this._versionDao.findByGithubReleaseId(
            version.githubReleaseId
          );
          if (existsVersion) {
            throw new Error("导入失败，版本已存在");
          }
          return this.decompressFrp(version, filePath);
        } else {
          throw new Error(`导入失败，所选 frp 架构与操作系统不符`);
        }
      } else {
        throw new Error("导入失败，无法识别文件");
      }
    }
  }

  getFrpVersionByAssetName(assetName: string) {
    return this._versions.find(f => f.assetName === assetName);
  }

  async decompressFrp(version: FrpcVersion, compressedPath: string) {
    const versionFilePath = path.join(
      PathUtils.getVersionStoragePath(),
      SecureUtils.calculateMD5(version.name)
    );
    const ext = path.extname(version.assetName);
    if (ext === GlobalConstant.ZIP_EXT) {
      this._systemService.decompressZipFile(compressedPath, versionFilePath);
      // todo delete frps and other file.
    } else if (
      ext === GlobalConstant.GZ_EXT &&
      version.assetName.includes(GlobalConstant.TAR_GZ_EXT)
    ) {
      this._systemService.decompressTarGzFile(
        compressedPath,
        versionFilePath,
        () => {
          // rename frpc.
          const frpcFilePath = path.join(versionFilePath, "frpc");
          if (fs.existsSync(frpcFilePath)) {
            const newFrpcFilePath = path.join(
              versionFilePath,
              PathUtils.getFrpcFilename()
            );
            fs.renameSync(frpcFilePath, newFrpcFilePath);
          }
          // delete downloaded file.
          // todo has bug.
          const downloadedFile = path.join(
            PathUtils.getDownloadStoragePath(),
            version.assetName
          );
          if (fs.existsSync(downloadedFile)) {
            fs.rmSync(downloadedFile, { recursive: true, force: true });
          }
        }
      );
    }

    // todo 2025-02-23 delete downloaded file.
    version.localPath = versionFilePath;
    version.downloaded = true;
    return await this._versionDao.insert(version);
  }
}

export default VersionService;
