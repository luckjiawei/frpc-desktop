import BaseRepository from "./BaseRepository";

// @Component()
class ServerRepository extends BaseRepository<OpenSourceFrpcDesktopServer> {
  constructor() {
    super("server");
  }

  async exists(id: string): Promise<boolean> {
    await this.ready();
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

  create(
    server: OpenSourceFrpcDesktopServer
  ): Promise<OpenSourceFrpcDesktopServer> {
    return this.insert(server);
  }
}

export default ServerRepository;
