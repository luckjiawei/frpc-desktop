class ResponseUtils {
  public static success<T>(data?: any, message?: string) {
    const resp: ApiResponse<T> = {
      success: true,
      data: data,
      message: message || "successful."
    };
    return resp;
  }

  public static fail(message?: string) {
    const resp: ApiResponse<any> = {
      success: false,
      data: null,
      message: message || "internal error."
    };
    return resp;
  }
}

export default ResponseUtils;
