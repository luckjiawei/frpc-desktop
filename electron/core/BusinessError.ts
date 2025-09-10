
enum ResponseCode {
  SUCCESS = "A1000;successful.",
  INTERNAL_ERROR = "B1000;internal error.",
  NOT_CONFIG = "B1001;未配置",
  VERSION_EXISTS = "B1002;导入失败，版本已存在",
  VERSION_ARGS_ERROR = "B1003;所选 frp 架构与操作系统不符",
  UNKNOWN_VERSION = "B1004;无法识别文件",
  NOT_FOUND_VERSION = "B1005;未找到版本"
}

class BusinessError extends Error {
  private readonly _bizCode: string;
  // constructor(bizCode: string, message: string) {
  //   super(message);
  //   this.bizCode = bizCode;
  //   this.name = "BusinessError";
  // }

  constructor(bizErrorEnum: ResponseCode) {
    const [bizCode, message] = bizErrorEnum.split(";");
    super(message);
    this._bizCode = bizCode;
    this.name = "BusinessError";
  }

  get bizCode(): string {
    return this._bizCode;
  }
}

export { BusinessError, ResponseCode };
