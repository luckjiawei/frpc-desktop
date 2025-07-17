import BaseRepository from "./BaseRepository";

// @Component()
class ManyServerRepository extends BaseRepository<FrpcDesktopServer> {
  constructor() {
    super("many-server-v2");
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

export default ManyServerRepository