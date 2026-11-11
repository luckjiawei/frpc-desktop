/**
 * 判断 latest 是否比 current 新。
 * 按数字比较各段，忽略前缀 v 与预发布后缀，避免 "2.0.10" < "2.0.9" 这类字符串比较错误。
 */
export const isNewerVersion = (latest: string, current: string) => {
  const parse = (version: string) =>
    version
      .replace(/^v/i, "")
      .split(/[-+]/)[0]
      .split(".")
      .map(part => Number.parseInt(part, 10) || 0);
  const latestParts = parse(latest);
  const currentParts = parse(current);
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const latestPart = latestParts[i] ?? 0;
    const currentPart = currentParts[i] ?? 0;
    if (latestPart !== currentPart) {
      return latestPart > currentPart;
    }
  }
  return false;
};
