import net from "net";

class NetUtils {
  /**
   * 检查指定端口是否被占用
   * @param port 端口号
   * @param host 主机地址，默认为 localhost
   * @returns Promise<boolean> true表示端口被占用，false表示端口可用
   */
  static async checkPortInUse(
    port: number,
    host: string = "localhost"
  ): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();

      server.listen(port, host, () => {
        server.once("close", () => {
          resolve(false); // 端口可用
        });
        server.close();
      });

      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          resolve(true); // 端口被占用
        } else {
          resolve(false); // 其他错误，认为端口可用
        }
      });
    });
  }
}

export default NetUtils;
