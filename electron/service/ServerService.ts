import BaseService from "./BaseService";
import ServerDao from "../dao/ServerDao";

class ServerService extends BaseService<FrpcDesktopServer> {
  constructor(serverDao: ServerDao) {
    super(serverDao);
  }

  saveServerConfig(frpcServer: FrpcDesktopServer) {}
}

export default ServerService;
