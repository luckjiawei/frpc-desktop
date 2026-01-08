/**
 * business error
 */
export default class BusinessError extends Error {
  private readonly _bizCode: string;

  constructor(bizErrorEnum: IResponseCode) {
    super(bizErrorEnum.message);
    this._bizCode = bizErrorEnum.code;
    this.name = "BusinessError";
  }

  get bizCode(): string {
    return this._bizCode;
  }
}
