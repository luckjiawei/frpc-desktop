import log from "electron-log/main";
import { ResponseCode } from "../core/constant";
import BusinessError from "../core/error";

class ResponseUtils {
  public static success<T>(data?: any, message?: string) {
    const { code, message: message2 } = ResponseCode.SUCCESS;
    const resp: ApiResponse<T> = {
      code: code,
      data: data,
      message: message || message2
    };
    return resp;
  }

  public static fail(err: Error) {
    log.scope("ipc").error("IPC Error.", err);
    if (!(err instanceof BusinessError)) {
      err = new BusinessError(ResponseCode.INTERNAL_ERROR);
    }
    const bizCode = (err as BusinessError).bizCode;
    const message = (err as BusinessError).message;

    const resp: ApiResponse<any> = {
      code: bizCode,
      data: null,
      message: message
    };

    return resp;
  }
}

export default ResponseUtils;
