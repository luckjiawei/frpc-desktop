import Datastore from "nedb";
import path from "path";
import Snowflakify from "snowflakify";
import GlobalConstant from "../core/GlobalConstant";
import PathUtils from "../utils/PathUtils";

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


class BaseDao<T> {
  protected readonly db: Datastore;

  constructor(dbName: string) {
    const dbFilename = path.join(
      PathUtils.getAppData(),
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

  //
  // deleteById(id: string): void {
  //   return null;
  // }
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
}

export default BaseDao;
