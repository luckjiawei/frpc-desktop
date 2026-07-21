import { BusinessError, ResponseCode } from "../core/BusinessError";

class ResponseUtils {
  private static isUserFacingErrorMessage(message?: string) {
    if (!message) {
      return false;
    }
    return [
      "导入失败",
      "未检测到外部 frpc 服务",
      "未能从外部 frpc 启动命令中读取配置文件路径",
      "The file is not a .zip file",
      "The file does not exist"
    ].some(prefix => message.startsWith(prefix));
  }

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
      const [bizCode, message] = ResponseCode.INTERNAL_ERROR.split(";");
      return {
        bizCode,
        data: null,
        message: this.isUserFacingErrorMessage(err?.message)
          ? err.message
          : message
      };
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
