import { app, net } from "electron";

class GitHubService {
  private static readonly REQUEST_TIMEOUT_MS = 10_000;

  constructor() {}

  private get userAgent(): string {
    return `frpc-desktop/${app.getVersion()}`;
  }

  getGithubRepoAllReleases(githubRepo: string): Promise<Array<GithubRelease>> {
    return this.getJson<Array<GithubRelease>>(
      `https://gh.jwinks.com/api/repos/${githubRepo}/releases?page=1&per_page=1000`
    );
  }

  getGithubLastRelease(githubRepo: string): Promise<GithubRelease> {
    return this.getJson<GithubRelease>(
      `https://gh.jwinks.com/api/repos/${githubRepo}/releases/latest`
    );
  }

  private getJson<T>(url: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request = net.request({
        method: "get",
        url
      });
      request.setHeader("User-Agent", this.userAgent);
      let settled = false;
      const finish = (error?: Error, value?: T) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(value as T);
        }
      };
      const timeout = setTimeout(() => {
        finish(
          new Error(
            `GitHub request timed out after ${GitHubService.REQUEST_TIMEOUT_MS}ms`
          )
        );
        request.abort();
      }, GitHubService.REQUEST_TIMEOUT_MS);

      request.on("response", response => {
        const responseData: Buffer[] = [];
        response.on("data", (data: Buffer) => {
          responseData.push(data);
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            finish(
              new Error(
                `GitHub request failed with HTTP ${response.statusCode}`
              )
            );
            return;
          }
          try {
            finish(
              undefined,
              JSON.parse(Buffer.concat(responseData).toString())
            );
          } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        });
        response.on("aborted", () => {
          finish(new Error("GitHub response was aborted"));
        });
        response.on("error", error => {
          finish(error);
        });
      });

      request.on("error", error => {
        finish(error);
      });

      request.end();
    });
  }
}

export default GitHubService;
