export function success<T>(data?: any, message?: string) {
  const resp: ApiResponse<T> = {
    success: true,
    data: data,
    message: message || "successful."
  };
  return resp;
}

// export function success(message?: string) {
//   const resp: ApiResponse<void> = {
//     success: true,
//     data: null,
//     message: message || "successful."
//   };
//   return resp;
// }

export function fail(message?: string) {
  const resp: ApiResponse<any> = {
    success: false,
    data: null,
    message: message || "internal error."
  };
  return resp;
}
