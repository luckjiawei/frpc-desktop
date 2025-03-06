import BaseRepository from "./BaseRepository";
import Component from "../core/annotation/Component";

// @Component()
class ProxyRepository extends BaseRepository<FrpcProxy> {
  constructor() {
    super("proxy");
  }

  updateProxyStatus(id: string, status: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.update(
        { _id: id },
        { $set: { status: status } },
        {},
        (err, numberOfUpdated, upsert) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
}

export default ProxyRepository;
