import { BusinessError, ResponseCode } from "../core/BusinessError";

class ResponseUtils {
  public static success<T>(data?: any, message?: string) {
    const [bizCode, message2] = ResponseCode.SUCCESS.split(";");
    const resp: ApiResponse<T> = {
      bizCode: bizCode,
      data: data,
      message: message || message2
    };
    return resp;
  }

  // public static fail(bizCode?: string, message?: string) {
  //   const resp: ApiResponse<any> = {
  //     success: false,
  //     bizCode: bizCode,
  //     data: null,
  //     message: message || "internal error."
  //   };
  //   return resp;
  // }

  public static fail(err: Error) {
    if (!(err instanceof BusinessError)) {
      err = new BusinessError(ResponseCode.INTERNAL_ERROR);
    }
    const bizCode = (err as BusinessError).bizCode;
    const message = (err as BusinessError).message;

    const resp: ApiResponse<any> = {
      bizCode: bizCode,
      data: null,
      message: message
    };
    return resp;
  }
}

export default ResponseUtils;
