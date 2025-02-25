import BaseRepository from "./BaseRepository";
import Component from "../core/annotation/Component";

// @Component()
class ServerRepository extends BaseRepository<OpenSourceFrpcDesktopServer> {
  constructor() {
    super("server");
  }

  exists(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.count({ _id: id }, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve(count > 0);
        }
      });
    });
  }
}

export default ServerRepository