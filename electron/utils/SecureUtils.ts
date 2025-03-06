import { createHash } from "crypto";

class SecureUtils {
  public static calculateMD5(str: string): string {
    const hash = createHash("md5");
    hash.update(str);
    return hash.digest("hex");
  }
}

export default SecureUtils;
