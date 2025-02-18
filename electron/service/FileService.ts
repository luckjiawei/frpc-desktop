import { shell } from "electron";

class FileService {
  constructor() {}

  openFile(filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
      shell
        .openPath(filePath)
        .then(errorMessage => {
          if (errorMessage) {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}

export default FileService;
