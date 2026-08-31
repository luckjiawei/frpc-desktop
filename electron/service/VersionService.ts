import { BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import GlobalConstant from "../core/GlobalConstant";
import Logger from "../core/Logger";
import VersionRepository from "../repository/VersionRepository";
import FileUtils from "../utils/FileUtils";
import PathUtils from "../utils/PathUtils";
import SecureUtils from "../utils/SecureUtils";
import BaseService from "./BaseService";
import GitHubService from "./GitHubService";
import SystemService from "./SystemService";

class VersionService extends BaseService<FrpcVersion> {
  private static readonly GITHUB_DOWNLOAD_MIRRORS: Record<string, string> = {
    "gh-jwinks": "https://gh.jwinks.com/file/"
  };

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

  async downloadFrpVersion(
    githubReleaseId: number,
    onProgress: Function,
    mirrorId?: string
  ) {
    return new Promise(async (resolve, reject) => {
      const version = this._versions.find(
        f => f.githubReleaseId === githubReleaseId
      );
      if (!version) {
        reject(new Error("version not found"));
        return;
      }
      const url = this.getDownloadUrl(version.browserDownloadUrl, mirrorId);
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

      Logger.info(
        `VersionService.downloadFrpVersion`,
        `Downloading version=${version.name}, asset=${version.assetName}, url=${url}`
      );

      // 动态导入 electron-dl (ESM 模块)
      const { download } = await import("electron-dl");

      download(BrowserWindow.getFocusedWindow(), url, {
        filename: `${version.assetName}`,
        directory: PathUtils.getDownloadStoragePath(),
        onProgress: progress => {
          onProgress(progress);
        },
        onCompleted: () => {
          Logger.info(
            `VersionService.downloadFrpVersion`,
            `Download completed: ${version.assetName}, starting decompression`
          );
          this.decompressFrp(version, downloadedFilePath)
            .then(data => {
              resolve(data);
            })
            .catch(err => {
              Logger.error(`VersionService.downloadFrpVersion`, err);
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
    const version =
      await this._versionDao.findByGithubReleaseId(githubReleaseId);
    if (!version) {
      return;
    }
    Logger.info(
      `VersionService.deleteFrpVersion`,
      `Deleting version=${version.name}, path=${version.localPath}`
    );
    if (version.localPath && fs.existsSync(version.localPath)) {
      fs.rmSync(version.localPath, { recursive: true, force: true });
    }
    await this._versionDao.deleteById(version._id);
    Logger.info(
      `VersionService.deleteFrpVersion`,
      `Version deleted: ${version.name}`
    );
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
    const { default: releases } = await import("../json/frp-releases.json");
    const versions = await this.githubRelease2FrpcVersion(
      releases as unknown as Array<GithubRelease>
    );
    this._versions = versions;
    return versions;
  }

  getFrpVersion() {}

  private getDownloadUrl(originalUrl: string, mirrorId?: string) {
    if (!mirrorId || mirrorId === "github") {
      return originalUrl;
    }
    const mirrorPrefix = VersionService.GITHUB_DOWNLOAD_MIRRORS[mirrorId];
    if (!mirrorPrefix) {
      return originalUrl;
    }
    return `${mirrorPrefix}${originalUrl}`;
  }

  private findCurrentArchitectureAsset(assets: Array<GithubAsset>) {
    return assets.find((af: GithubAsset) => {
      return this._currFrpArch.every(item => af.name.includes(item));
    });
  }

  private async githubRelease2FrpcVersion(
    releases: Array<GithubRelease>
  ): Promise<Array<FrpcVersion>> {
    const allVersions = await this._versionDao.findAll();
    const filtered = releases
      .filter(release => {
        // only support toml version.
        return release.id > 124395282;
      })
      .filter(release => {
        return this.findCurrentArchitectureAsset(release.assets);
      });

    return Promise.all(
      filtered.map(async (m: GithubRelease) => {
        const asset = this.findCurrentArchitectureAsset(m.assets);
        const download_count = m.assets.reduce(
          (sum, item) => sum + item.download_count,
          0
        );

        const currVersion = allVersions.find(ff => ff.githubReleaseId === m.id);
        const binaryExists = this.frpcVersionExists(currVersion);

        // If DB record exists but binary was deleted (e.g., by antivirus), clean up stale record
        if (currVersion && !binaryExists) {
          Logger.warn(
            `VersionService.githubRelease2FrpcVersion`,
            `Binary missing for version=${m.name}, removing stale DB record`
          );
          await this._versionDao.deleteById(currVersion._id);
        }

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
          downloaded: binaryExists,
          localPath: binaryExists ? currVersion.localPath : null,
          size: FileUtils.formatBytes(asset.size)
        };
        return v;
      })
    );
  }

  private frpcVersionExists(version: FrpcVersion): boolean {
    if (version && version.localPath) {
      const filename =
        process.platform === "win32"
          ? PathUtils.getWinFrpFilename()
          : PathUtils.getFrpcFilename();
      return fs.existsSync(path.join(version.localPath, filename));
    }
    return false;
  }

  async importLocalFrpcVersion(filePath: string) {
    Logger.info(
      `VersionService.importLocalFrpcVersion`,
      `Importing local file: ${filePath}`
    );
    const checksum = FileUtils.calculateFileChecksum(filePath);
    const { default: checksumData } =
      await import("../json/frp_all_sha256_checksums.json");
    const frpChecksums = checksumData as Record<string, string>;
    const frpName = frpChecksums[checksum];
    if (frpName) {
      if (this._currFrpArch.every(item => frpName.includes(item))) {
        Logger.info(
          `VersionService.importLocalFrpcVersion`,
          `Checksum matched: ${frpName}`
        );
        const version = this.getFrpVersionByAssetName(frpName);
        const existsVersion = await this._versionDao.findByGithubReleaseId(
          version.githubReleaseId
        );
        if (existsVersion) {
          throw new BusinessError(ResponseCode.VERSION_EXISTS);
        }
        return this.decompressFrp(version, filePath);
      } else {
        Logger.warn(
          `VersionService.importLocalFrpcVersion`,
          `Architecture mismatch: file=${frpName}, current=${this._currFrpArch.join(",")}`
        );
        throw new BusinessError(ResponseCode.VERSION_ARGS_ERROR);
      }
    } else {
      Logger.warn(
        `VersionService.importLocalFrpcVersion`,
        `Unknown version, checksum not found: ${checksum}`
      );
      throw new BusinessError(ResponseCode.UNKNOWN_VERSION);
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
    const fileName = path.basename(version.assetName, ext);
    Logger.info(
      `VersionService.decompressFrp`,
      `Decompressing version=${version.name}, src=${compressedPath}, dest=${versionFilePath}`
    );
    if (ext === GlobalConstant.ZIP_EXT) {
      this._systemService.decompressZipFile(compressedPath, versionFilePath);
      const frpTempPath = path.join(versionFilePath, fileName);
      fs.renameSync(
        path.join(frpTempPath, "frpc.exe"),
        path.join(versionFilePath, PathUtils.getWinFrpFilename())
      );
      fs.rmSync(frpTempPath, { recursive: true, force: true });
      Logger.info(
        `VersionService.decompressFrp`,
        `Decompression completed (zip): ${version.name}`
      );
    } else if (
      ext === GlobalConstant.GZ_EXT &&
      version.assetName.includes(GlobalConstant.TAR_GZ_EXT)
    ) {
      this._systemService.decompressTarGzFile(
        compressedPath,
        versionFilePath,
        () => {
          const frpcFilePath = path.join(versionFilePath, "frpc");
          if (fs.existsSync(frpcFilePath)) {
            const newFrpcFilePath = path.join(
              versionFilePath,
              PathUtils.getFrpcFilename()
            );
            fs.renameSync(frpcFilePath, newFrpcFilePath);
          }
          const downloadedFile = path.join(
            PathUtils.getDownloadStoragePath(),
            version.assetName
          );
          if (fs.existsSync(downloadedFile)) {
            fs.rmSync(downloadedFile, { recursive: true, force: true });
          }
          Logger.info(
            `VersionService.decompressFrp`,
            `Decompression completed (tar.gz): ${version.name}`
          );
        }
      );
    }

    version.localPath = versionFilePath;
    version.downloaded = true;
    return await this._versionDao.insert(version);
  }
}

export default VersionService;
