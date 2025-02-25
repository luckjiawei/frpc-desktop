
enum ResponseCode {
  SUCCESS = "A1000:successful.",
  INTERNAL_ERROR = "B1000:internal error.",
  NOT_CONFIG = "B1001:未配置"
}

class BusinessError extends Error {
  private readonly _bizCode: string;
  // constructor(bizCode: string, message: string) {
  //   super(message);
  //   this.bizCode = bizCode;
  //   this.name = "BusinessError";
  // }

  constructor(bizErrorEnum: ResponseCode) {
    const [bizCode, message] = bizErrorEnum.split(":");
    super(message);
    this._bizCode = bizCode;
    this.name = "BusinessError";
  }

  get bizCode(): string {
    return this._bizCode;
  }
}

export { BusinessError, ResponseCode };
