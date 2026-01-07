import "reflect-metadata";
import { net } from "electron";
import { injectable } from "inversify";
import log from "electron-log/main";
import BusinessError from "../core/error";
import { ResponseCode } from "../core/constant";

@injectable()
class GitHubService {
  constructor() { }

  private githubHeaders() {
    const ghToken = process.env.GH_TOKEN;
    if (!ghToken) {
      log.scope("github").warn("GH_TOKEN is not set, API rate limits may be restricted.");
      return {
        "User-Agent": "frpc-desktop",
      };
    } else {
      return {
        "User-Agent": "frpc-desktop",
        "Authorization": `token ${ghToken}`
      };
    }

  }

  /**
   * 
   * @param githubRepo 
   * @returns 
   */
  getGithubRepoAllReleases(githubRepo: string): Promise<Array<GithubRelease>> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: "get",
        url: `https://api.github.com/repos/${githubRepo}/releases?page=1&per_page=1000`,
        headers: this.githubHeaders()
      });

      request.on("response", response => {
        let responseData: Buffer = Buffer.alloc(0);

        response.on("data", (data: Buffer) => {
          responseData = Buffer.concat([responseData, data]);
        });

        response.on("end", () => {
          if (response.statusCode === 200) {
            this.parseGitHubVersion(responseData.toString())
              .then(data => {
                resolve(data);
              })
              .catch(err => reject(err));
          } else if (response.statusCode === 403) {
            log.scope("github").error(`Failed to retrieve GitHub releases. Status code: ${response.statusCode}`);
            reject(
              new BusinessError(
                ResponseCode.GITHUB_UNAUTHORIZED
              )
            );
          }
          else {
            log.scope("github").error(`Failed to retrieve GitHub releases. Status code: ${response.statusCode}`);
            reject(
              new BusinessError(
                ResponseCode.GITHUB_NETWORK_ERROR
              )
            );
          }
        });
        response.on("error", (error) => {
          reject(error);
        });
      });

      request.on("error", error => {
        reject(error);
      });

      request.end();
    });
  }

  getGithubLastRelease(githubRepo: string) {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: "get",
        url: `https://api.github.com/repos/${githubRepo}/releases/latest`,
        headers: this.githubHeaders()
      });
      request.on("response", response => {
        let responseData: Buffer = Buffer.alloc(0);
        response.on("data", (data: Buffer) => {
          responseData = Buffer.concat([responseData, data]);
        });
        response.on("end", () => {
          if (response.statusCode === 200) {
            try {
              const release: GithubRelease = JSON.parse(
                responseData.toString()
              );
              resolve(release);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(
              new Error(
                `Failed to get GitHub release. Status code: ${response.statusCode}`
              )
            );
          }
        });
        response.on("error", (error) => {
          reject(error);
        });
      });

      request.on("error", error => {
        reject(error);
      });

      request.end();
    });
  }

  parseGitHubVersion(
    githubReleaseJsonStr: string
  ): Promise<Array<GithubRelease>> {
    return new Promise<Array<GithubRelease>>(resolve => {
      const githubReleases: Array<GithubRelease> =
        JSON.parse(githubReleaseJsonStr);
      resolve(githubReleases);
    });
  }
}

export default GitHubService;
