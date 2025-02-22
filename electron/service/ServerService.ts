import BaseService from "./BaseService";
import ServerDao from "../dao/ServerDao";

class ServerService extends BaseService<FrpcDesktopServer> {
  private readonly _serverDao: ServerDao;
  constructor(serverDao: ServerDao) {
    super();
    this._serverDao = serverDao;
  }

  async saveServerConfig(
    frpcServer: FrpcDesktopServer
  ): Promise<FrpcDesktopServer> {
    return await this._serverDao.updateById("1", frpcServer);
  }

  async getServerConfig(): Promise<FrpcDesktopServer> {
    return await this._serverDao.findById("1");
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
