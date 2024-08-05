import Datastore from "nedb";
import path from "path";
import {Proxy} from "./proxy";
import {app} from "electron";

const versionDB = new Datastore({
    autoload: true,
    filename: path.join(app.getPath("userData"), "version.db")
});

/**
 * 新增代理
 * @param proxy
 * @param cb
 */
export const insertVersion = (
    version: any,
    cb?: (err: Error | null, document: any) => void
) => {
    versionDB.insert(version, cb);
};

/**
 * 查找
 * @param cb
 */
export const listVersion = (
    callback: (err: Error | null, documents: any[]) => void
) => {
    versionDB.find({}, callback);
};

export const getVersionById = (
    id: string,
    callback: (err: Error | null, document: any) => void
) => {
    versionDB.findOne({id: id}, callback);
};

export const deleteVersionById = (id: string, callback: (err: Error | null, document: any) => void) => {
    versionDB.remove({id: id}, callback);
}