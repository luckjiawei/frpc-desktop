import BaseRepository from "./BaseRepository";
import Component from "../core/annotation/Component";

// @Component()
class VersionRepository extends BaseRepository<FrpcVersion> {
  constructor() {
    super("version");
  }

  findByGithubReleaseId(githubReleaseId: number): Promise<FrpcVersion> {
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

  exists(githubReleaseId: number): Promise<boolean> {
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
