import BaseDao from "./BaseDao";

class ServerDao extends BaseDao<FrpcDesktopServer> {
  constructor() {
    super("config");
  }
}

export default ServerDao