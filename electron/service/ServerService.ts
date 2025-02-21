import BaseService from "./BaseService";
import ServerDao from "../dao/ServerDao";

class ServerService extends BaseService<FrpcDesktopServer> {
  private readonly _serverDao: ServerDao;
  constructor(serverDao: ServerDao) {
    super();
    this._serverDao = serverDao;
  }

  saveServerConfig(frpcServer: FrpcDesktopServer): Promise<void> {
    return new Promise((resolve, reject) => {
      this._serverDao
        .updateById("1", frpcServer)
        .then(() => {
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  getServerConfig(): Promise<FrpcDesktopServer> {
    return new Promise((resolve, reject) => {
      this._serverDao
        .findById("1")
        .then((frpcServer: FrpcDesktopServer) => {
          resolve(frpcServer);
        })
        .catch(err => reject(err));
    });
  }

  hasServerConfig(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._serverDao
        .exists("1")
        .then(r => {
          resolve(r);
        })
        .catch(err => reject(err));
    });
  }
}

export default ServerService;
