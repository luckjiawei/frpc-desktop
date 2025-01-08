import Datastore from "nedb";
import path from "path";
import { app } from "electron";

import { logInfo, logError, LogModule, logDebug } from "../utils/log";

const versionDB = new Datastore({
  autoload: true,
  filename: path.join(app.getPath("userData"), "version.db")
});

/**
 * Insert version
 * @param version
 * @param cb
 */
export const insertVersion = (
  version: FrpVersion,
  cb?: (err: Error | null, document: any) => void
) => {
  logInfo(LogModule.DB, `Inserting version: ${JSON.stringify(version)}`);
  versionDB.insert(version, (err, document) => {
    if (err) {
      logError(LogModule.DB, `Error inserting version: ${err.message}`);
    } else {
      logInfo(LogModule.DB, `Version inserted successfully: ${JSON.stringify(document)}`);
    }
    if (cb) cb(err, document);
  });
};

/**
 * List versions
 * @param cb
 */
export const listVersion = (
  callback: (err: Error | null, documents: FrpVersion[]) => void
) => {
  logInfo(LogModule.DB, "Listing all versions.");
  versionDB.find({}, (err, documents) => {
    if (err) {
      logError(LogModule.DB, `Error listing versions: ${err.message}`);
    } else {
      logInfo(LogModule.DB, `Successfully listed versions: ${documents.length} found.`);
    }
    callback(err, documents);
  });
};

export const getVersionById = (
  id: number,
  callback: (err: Error | null, document: FrpVersion) => void
) => {
  logInfo(LogModule.DB, `Retrieving version by ID: ${id}`);
  versionDB.findOne({ id: id }, (err, document) => {
    if (err) {
      logError(LogModule.DB, `Error retrieving version by ID: ${err.message}`);
    } else {
      logInfo(LogModule.DB, `Version retrieved successfully: ${JSON.stringify(document)}`);
    }
    callback(err, document);
  });
};

export const deleteVersionById = (
  id: string,
  callback: (err: Error | null, document: any) => void
) => {
  logInfo(LogModule.DB, `Deleting version: ${id}`);
  versionDB.remove({ id: id }, (err, document) => {
    if (err) {
      logError(LogModule.DB, `Error deleting version: ${err.message}`);
    } else {
      logInfo(LogModule.DB, `Version deleted successfully: ${id}`);
    }
    callback(err, document);
  });
};

export const clearVersion = (cb?: (err: Error | null, n: number) => void) => {
  logInfo(LogModule.DB, "Clearing all versions from the database.");
  versionDB.remove({}, { multi: true }, (err, n) => {
    if (err) {
      logError(LogModule.DB, `Error clearing versions: ${err.message}`);
    } else {
      logInfo(LogModule.DB, `Successfully cleared versions. Number of documents removed: ${n}`);
    }
    if (cb) cb(err, n);
  });
};
