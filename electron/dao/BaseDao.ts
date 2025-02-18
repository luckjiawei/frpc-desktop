import Datastore from "nedb";
import path from "path";
import { app } from "electron";

interface BaseDaoInterface<T> {
  db: Datastore;

  insert(t: T): Promise<T>;

  updateById(t: T): T;

  deleteById(id: string): void;

  findAll(): T[];
}

class BaseDao<T> implements BaseDaoInterface<T> {
  db: Datastore;

  constructor(dbName: string) {
    const dbFilename = path.join(app.getPath("userData"), `${dbName}-v2.db`);
    this.db = new Datastore({
      autoload: true,
      filename: dbFilename
    });
    // todo log
  }

  async insert(t: T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      resolve(t);
    });
  }

  updateById(t: T): T {
    return null;
  }

  deleteById(id: string): void {
    return null;
  }

  findAll(): T[] {
    return null;
  }
}

export default BaseDao;
