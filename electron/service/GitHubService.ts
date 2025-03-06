import { net } from "electron";

class GitHubService {
  constructor() {}

  getGithubRepoAllReleases(githubRepo: string): Promise<Array<GithubRelease>> {
    return new Promise((resolve, reject) => {

      const request = net.request({
        method: "get",
        url: `https://api.github.com/repos/${githubRepo}/releases?page=1&per_page=1000`
      });

      request.on("response", response => {
        // logInfo(
        //   LogModule.GITHUB,
        //   `Received response with status code: ${response.statusCode}`
        // );
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
            // logInfo(
            //   LogModule.GITHUB,
            //   "Successfully retrieved GitHub release data."
            // );
          } else {
            // logWarn(
            //   LogModule.GITHUB,
            //   "Failed to retrieve data, using local JSON instead. Status code: " +
            //     response.statusCode
            // );
          }
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
        url: `https://api.github.com/repos/${githubRepo}/releases/latest`
      });
      request.on("response", response => {
        let responseData: Buffer = Buffer.alloc(0);
        response.on("data", (data: Buffer) => {
          responseData = Buffer.concat([responseData, data]);
        });
        response.on("end", () => {
          if (response.statusCode === 200) {
            const release: GithubRelease = JSON.parse(responseData.toString());
            resolve(release);
          }
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
