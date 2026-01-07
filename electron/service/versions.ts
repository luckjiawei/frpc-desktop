import "reflect-metadata";
import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { ResponseCode } from "../core/constant";
import { GlobalConstant } from "../core/constant";
import frpReleasesJson from "../json/frp-releases.json";
import frpChecksums from "../json/frp_all_sha256_checksums.json";
import VersionRepository from "../repository/versions";
import FileUtils from "../utils/file";
import PathUtils from "../utils/PathUtils";
import SecureUtils from "../utils/SecureUtils";
import GitHubService from "./github";
import SystemService from "./SystemService";
import VersionConverter from "electron/converter/versions";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import BusinessError from "../core/error";
import log from "electron-log/main";

@injectable()
export default class VersionService {
  @inject(TYPES.VersionRepository)
  private readonly _versionRepository: VersionRepository;
  @inject(TYPES.VersionConverter)
  private readonly _versionConverter: VersionConverter;
  @inject(TYPES.SystemService)
  private readonly _systemService: SystemService;
  @inject(TYPES.GitHubService)
  private readonly _gitHubService: GitHubService;
  private readonly _currFrpArch: Array<string>;
  private _versions: Array<FrpcDesktopVersion> = [];

  constructor(
  ) {
    const nodeVersion = `${process.platform}_${process.arch}`;
    this._currFrpArch = GlobalConstant.FRP_ARCH_VERSION_MAPPING[nodeVersion];
  }

  /**
   * download
   * @param githubReleaseId
   * @param onProgress
   */
  async downloadFrpVersion(githubReleaseId: number, onProgress: Function) {
    return new Promise(async (resolve, reject) => {
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

      // 动态导入 electron-dl (ESM 模块)
      const { download } = await import("electron-dl");

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
    const version = await this._versionRepository.findByGithubReleaseId(
      githubReleaseId
    );
    if (this.versionFileExists(version)) {
      FileUtils.remove(version.local_path);
      await this._versionRepository.deleteById(version.id);
    }
  }

  async getFrpVersionsByGitHub(): Promise<Array<FrpcDesktopVersion>> {
    const gvs = await this._gitHubService
      .getGithubRepoAllReleases("fatedier/frp");

    const versions: Array<FrpcDesktopVersion> =
      await this.githubRelease2FrpcDesktopVersion(gvs);
    this._versions = versions;
    return versions;
  }

  async getFrpVersionByLocalJson(): Promise<Array<FrpcDesktopVersion>> {
    return this.githubRelease2FrpcDesktopVersion(frpReleasesJson);
  }

  private findCurrentArchitectureAsset(assets: Array<GithubAsset>) {
    return assets.find((af: GithubAsset) => {
      return this._currFrpArch.every(item => af.name.includes(item));
    });
  }

  private async githubRelease2FrpcDesktopVersion(
    releases: Array<GithubRelease>
  ): Promise<Array<FrpcDesktopVersion>> {
    const allVersions = await this._versionRepository.selectAll();
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
        const v: FrpcDesktopVersion = {
          id: null,
          githubAssetId: asset.id,
          githubReleaseId: m.id,
          githubCreatedAt: asset.created_at,
          name: m.name,
          assetName: asset.name,
          versionDownloadCount: download_count,
          assetDownloadCount: asset.download_count,
          browserDownloadUrl: asset.browser_download_url,
          downloaded: this.versionFileExists(currVersion),
          localPath: currVersion && currVersion.local_path,
          size: FileUtils.formatBytes(asset.size)
        };
        return v;
      });
  }

  private versionFileExists(version: VersionModel): boolean {
    if (version) {
      return FileUtils.exists(version.local_path);
    }
    return false;
  }

  async importLocalVersionModel(filePath: string) {
    const checksum = FileUtils.calculateFileChecksum(filePath);
    const frpName = frpChecksums[checksum];
    if (frpName) {
      if (this._currFrpArch.every(item => frpName.includes(item))) {
        const version = this.getFrpVersionByAssetName(frpName);
        const existsVersion = await this._versionRepository.findByGithubReleaseId(
          version.githubReleaseId
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
    return this._versions.find(f => f.assetName === assetName);
  }

  async decompressFrp(version: FrpcDesktopVersion, compressedPath: string) {
    const versionFilePath = path.join(
      PathUtils.getVersionStoragePath(),
      SecureUtils.calculateMD5(version.name)
    );
    const ext = path.extname(version.assetName);
    const fileName = path.basename(version.assetName, ext);
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
    return await this._versionRepository.insert(this._versionConverter.frpcDesktopVersion2Model(version));
  }

  public async getDownloadedVersions() {
    await this.cleanUselessVersion();
    return (await this._versionRepository.selectAll()).map(m => this._versionConverter
      .model2FrpcDesktopVersion(m)
    );
  }

  /**
   * import local frpc version
   * @param filePath file path
   * @returns 
   */
  public async importLocalFrpcVersion(filePath: string) {
    const checksum = FileUtils.calculateFileChecksum(filePath);
    const frpName = frpChecksums[checksum];
    if (frpName) {
      if (this._currFrpArch.every(item => frpName.includes(item))) {
        const version = this.getFrpVersionByAssetName(frpName);
        const existsVersion = await this._versionRepository.findByGithubReleaseId(
          version.githubReleaseId
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

  /**
   * 
   */
  public async cleanUselessVersion() {
    const versions = await this._versionRepository.selectAll();
    versions.forEach(f => {
      if (!FileUtils.exists(f.local_path)) {
        this._versionRepository.deleteById(f.id);
        log.scope("version").info(`delete useless version: ${f.id}`);
      }
    })
  }

}
