import BaseDao from "./BaseDao";

class ServerDao extends BaseDao<OpenSourceFrpcDesktopServer> {
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

export default ServerDao