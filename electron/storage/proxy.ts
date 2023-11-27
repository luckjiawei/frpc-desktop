import Datastore from "nedb";
import path from "path";
import { app } from "electron";

const proxyDB = new Datastore({
  autoload: true,
  filename: path.join(app.getPath("userData"), "proxy.db")
});

export type Proxy = {
  _id: string;
  name: string;
  type: string;
  localIp: string;
  localPort: number;
  remotePort: number;
  customDomains: string[];
};
/**
 * 新增代理
 * @param proxy
 * @param cb
 */
export const insertProxy = (
  proxy: Proxy,
  cb?: (err: Error | null, document: Proxy) => void
) => {
  console.log("新增", proxy);
  proxyDB.insert(proxy, cb);
};

/**
 * 删除代理
 * @param _id
 * @param cb
 */
export const deleteProxyById = (
  _id: string,
  cb?: (err: Error | null, n: number) => void
) => {
  proxyDB.remove({ _id: _id }, cb);
};

/**
 * 修改代理
 */
export const updateProxyById = (
  proxy: Proxy,
  cb?: (err: Error | null, numberOfUpdated: number, upsert: boolean) => void
) => {
  proxyDB.update({ _id: proxy._id }, proxy, {}, cb);
};

/**
 * 查找
 * @param cb
 */
export const listProxy = (
  callback: (err: Error | null, documents: Proxy[]) => void
) => {
  proxyDB.find({}, callback);
};

/**
 * 根据id查询
 * @param id
 * @param callback
 */
export const getProxyById = (
  id: string,
  callback: (err: Error | null, document: Proxy) => void
) => {
  proxyDB.findOne({ _id: id }, callback);
};
