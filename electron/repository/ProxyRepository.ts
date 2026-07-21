import BaseRepository from "./BaseRepository";

// @Component()
class ProxyRepository extends BaseRepository<FrpcProxy> {
  constructor() {
    super("proxy");
  }

  async upsertByNameAndType(proxy: FrpcProxy): Promise<FrpcProxy> {
    await this.ready();
    return new Promise<FrpcProxy>((resolve, reject) => {
      this.db.findOne(
        { name: proxy.name, type: proxy.type },
        (findErr, document) => {
          if (findErr) {
            reject(findErr);
            return;
          }

          const id = document?._id || this.genId();
          const nextProxy = {
            ...proxy,
            _id: id
          };

          this.db.update({ _id: id }, nextProxy, { upsert: true }, err => {
            if (err) {
              reject(err);
            } else {
              resolve(nextProxy);
            }
          });
        }
      );
    });
  }

  async upsertManyByNameAndType(proxies: Array<FrpcProxy>) {
    const results: Array<FrpcProxy> = [];
    for (const proxy of proxies) {
      results.push(await this.upsertByNameAndType(proxy));
    }
    return results;
  }

  async updateProxyStatus(id: string, status: number): Promise<void> {
    await this.ready();
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
