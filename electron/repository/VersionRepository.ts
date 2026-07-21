import BaseRepository from "./BaseRepository";

// @Component()
class VersionRepository extends BaseRepository<FrpcVersion> {
  constructor() {
    super("version");
  }

  async findByGithubReleaseId(githubReleaseId: number): Promise<FrpcVersion> {
    await this.ready();
    return new Promise<FrpcVersion>((resolve, reject) => {
      this.db.findOne({ githubReleaseId: githubReleaseId }, (err, document) => {
        if (err) {
          reject(err);
        } else {
          resolve(document);
        }
      });
    });
  }

  async exists(githubReleaseId: number): Promise<boolean> {
    await this.ready();
    return new Promise((resolve, reject) => {
      this.db.count({ githubReleaseId: githubReleaseId }, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count > 0);
        }
      });
    });
  }
}

export default VersionRepository;
