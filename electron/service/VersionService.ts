import "reflect-metadata";
import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { ResponseCode } from "../core/constant";
import { GlobalConstant } from "../core/constant";
import frpReleasesJson from "../json/frp-releases.json";
import frpChecksums from "../json/frp_all_sha256_checksums.json";
import VersionRepository from "../repository/VersionRepository";
import FileUtils from "../utils/FileUtils";
import PathUtils from "../utils/PathUtils";
import SecureUtils from "../utils/SecureUtils";
import GitHubService from "./GitHubService";
import SystemService from "./SystemService";
import VersionConverter from "electron/converter/VersionConverter";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import BusinessError from "../core/error";

@injectable()
export default class VersionService {
  @inject(TYPES.VersionRepository)
  private readonly _versionDao: VersionRepository;

  @inject(TYPES.VersionConverter)
  private readonly _versionConverter: VersionConverter;

  @inject(TYPES.SystemService)
  private readonly _systemService: SystemService;

  @inject(TYPES.GitHubService)
  private readonly _gitHubService: GitHubService;

  private readonly _currFrpArch: Array<string>;
  private _versions: Array<VersionModel> = [];

  constructor(
  ) {
    const nodeVersion = `${process.platform}_${process.arch}`;
    this._currFrpArch = GlobalConstant.FRP_ARCH_VERSION_MAPPING[nodeVersion];
  }

  async downloadFrpVersion(githubReleaseId: number, onProgress: Function) {
    return new Promise(async (resolve, reject) => {
      const version = this._versions.find(
        f => f.github_asset_id === githubReleaseId
      );
      if (!version) {
        reject(new Error("version not found"));
      }
      const url = version.browser_download_url;
      const downloadedFilePath = path.join(
        PathUtils.getDownloadStoragePath(),
        `${version.asset_name}`
      );

      const versionFilePath = path.join(
        PathUtils.getVersionStoragePath(),
        SecureUtils.calculateMD5(version.name)
      );

      if (fs.existsSync(versionFilePath)) {
        fs.rmSync(versionFilePath, { recursive: true, force: true });
      }

      // 动态导入 electron-dl (ESM 模块)
      const { download } = await import("electron-dl");

      // const targetPath = path.resolve();
      download(BrowserWindow.getFocusedWindow(), url, {
        filename: `${version.asset_name}`,
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
    if (this.versionModelExists(version)) {
      fs.rmSync(version.local_path, { recursive: true, force: true });
      await this._versionDao.deleteById(version.id);
    }
  }

  async getFrpVersionsByGitHub(): Promise<Array<VersionModel>> {
    const gvs = await this._gitHubService
      .getGithubRepoAllReleases("fatedier/frp");

    const versions: Array<VersionModel> =
      await this.githubRelease2VersionModel(gvs);
    this._versions = versions;
    return versions;

  }

  async getFrpVersionByLocalJson(): Promise<Array<VersionModel>> {
    return this.githubRelease2VersionModel(frpReleasesJson);
  }

  private findCurrentArchitectureAsset(assets: Array<GithubAsset>) {
    return assets.find((af: GithubAsset) => {
      return this._currFrpArch.every(item => af.name.includes(item));
    });
  }

  private async githubRelease2VersionModel(
    releases: Array<GithubRelease>
  ): Promise<Array<VersionModel>> {
    const allVersions = await this._versionDao.selectAll();
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

        const currVersion = allVersions.find(ff => ff.github_release_id === m.id);
        const v: VersionModel = {
          id: null,
          github_asset_id: asset.id,
          github_release_id: m.id,
          github_created_at: asset.created_at,
          name: m.name,
          asset_name: asset.name,
          version_download_count: download_count,
          asset_download_count: asset.download_count,
          browser_download_url: asset.browser_download_url,
          downloaded: this.versionModelExists(currVersion),
          local_path: currVersion && currVersion.localPath,
          size: FileUtils.formatBytes(asset.size)
        };
        return v;
      });
  }

  private versionModelExists(version: VersionModel): boolean {
    if (version) {
      return fs.existsSync(version.local_path);
    }
    return false;
  }

  async importLocalVersionModel(filePath: string) {
    const checksum = FileUtils.calculateFileChecksum(filePath);
    const frpName = frpChecksums[checksum];
    if (frpName) {
      if (this._currFrpArch.every(item => frpName.includes(item))) {
        const version = this.getFrpVersionByAssetName(frpName);
        const existsVersion = await this._versionDao.findByGithubReleaseId(
          version.github_release_id
        );
        if (existsVersion) {
          throw new BusinessError(ResponseCode.VERSION_EXISTS);
        }
        return this.decompressFrp(version, filePath);
      } else {
        throw new BusinessError(ResponseCode.VERSION_ARGS_ERROR);
      }
    } else {
      throw new BusinessError(ResponseCode.UNKNOWN_VERSION);
    }
  }

  getFrpVersionByAssetName(assetName: string) {
    return this._versions.find(f => f.asset_name === assetName);
  }

  async decompressFrp(version: VersionModel, compressedPath: string) {
    const versionFilePath = path.join(
      PathUtils.getVersionStoragePath(),
      SecureUtils.calculateMD5(version.name)
    );
    const ext = path.extname(version.asset_name);
    const fileName = path.basename(version.asset_name, ext);
    if (ext === GlobalConstant.ZIP_EXT) {
      this._systemService.decompressZipFile(compressedPath, versionFilePath);
      const frpTempPath = path.join(versionFilePath, fileName);
      fs.renameSync(
        path.join(frpTempPath, "frpc.exe"),
        path.join(versionFilePath, PathUtils.getWinFrpFilename())
      );
      fs.rmSync(frpTempPath, { recursive: true, force: true });
    } else if (
      ext === GlobalConstant.GZ_EXT &&
      version.asset_name.includes(GlobalConstant.TAR_GZ_EXT)
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
            version.asset_name
          );
          if (fs.existsSync(downloadedFile)) {
            fs.rmSync(downloadedFile, { recursive: true, force: true });
          }
        }
      );
    }

    // todo 2025-02-23 delete downloaded file.
    version.local_path = versionFilePath;
    version.downloaded = true;
    return await this._versionDao.insert(version);
  }

  public async getDownloadedVersions() {
    return await this._versionDao.selectAll();
  }
}
