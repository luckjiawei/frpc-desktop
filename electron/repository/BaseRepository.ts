import Datastore from "nedb";
import path from "path";
import PathUtils from "../utils/PathUtils";
import IdUtils from "../utils/IdUtils";

// interface BaseDaoInterface<T> {
//   db: Datastore;
//
//   insert(t: T): Promise<T>;
//
//   //
//   updateById(id: string, t: T): Promise<T>;
//
//   //
//   // deleteById(id: string): void;
//   //
//   // findAll(): T[];
//
//   findById(id: string): Promise<T>;
// }

class BaseRepository<T> {
  protected readonly db: Datastore;

  constructor(dbName: string) {
    const dbFilename = path.join(
      PathUtils.getDataBaseStoragePath(),
      `${dbName}-v2.db`
    );
    this.db = new Datastore({
      autoload: true,
      filename: dbFilename
    });
    // todo log
  }

  protected genId(): string {
    return IdUtils.genUUID();
  }

  // async insert(t: T): Promise<T> {
  //   return new Promise<T>((resolve, reject) => {
  //     resolve(t);
  //   });
  // }
  //
  insert(t: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      t["_id"] = this.genId();
      this.db.insert(t, (err, document) => {
        if (err) {
          reject(err);
        }
        resolve(document);
      });
    });
  }

  insertMany(ts: Array<T>): Promise<Array<T>> {
    return new Promise<Array<T>>((resolve, reject) => {
      ts.forEach(t => {
        t["_id"] = this.genId();
      });
      this.db.insert(ts, (err, documents) => {
        if (err) {
          reject(err);
        } else {
          resolve(documents);
        }
      });
    });
  }

  updateById(id: string, t: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.db.update(
        { _id: id },
        t,
        { upsert: true },
        (err, numberOfUpdated, upsert) => {
          if (err) {
            reject(err);
          } else {
            t["_id"] = id;
            resolve(t);
            // this.findById(id)
            //   .then(data => {
            //     resolve(t);
            //   })
            //   .catch(err2 => {
            //     reject(err2);
            //   });
          }
        }
      );
    });
  }

  deleteById(id: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.remove({ _id: id }, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  //
  // findAll(): T[] {
  //   return null;
  // }

  findById(id: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.db.findOne({ _id: id }, (err, document) => {
        if (err) {
          reject(err);
        } else {
          resolve(document);
        }
      });
    });
  }

  findAll(): Promise<Array<T>> {
    return new Promise<Array<T>>((resolve, reject) => {
      this.db.find({}, (err, document) => {
        if (err) {
          reject(err);
        } else {
          resolve(document);
        }
      });
    });
  }

  truncate() {
    return new Promise<void>((resolve, reject) => {
      this.db.remove({}, { multi: true }, (err, n) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default BaseRepository;
