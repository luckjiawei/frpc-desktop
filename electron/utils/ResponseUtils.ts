import { BusinessError, ResponseCode } from "../core/BusinessError";

class ResponseUtils {
  public static success<T>(data?: any, message?: string) {
    const [bizCode, message2] = ResponseCode.SUCCESS.split(":");
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
    let bizCode = "";
    let message = "";
    if (err instanceof BusinessError) {
      bizCode = (err as BusinessError).bizCode;
      message = (err as BusinessError).message;
    }
    const resp: ApiResponse<any> = {
      bizCode: bizCode,
      data: null,
      message: message || "internal error."
    };
    return resp;
  }
}

export default ResponseUtils;
