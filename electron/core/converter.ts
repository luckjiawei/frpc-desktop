export default abstract class BaseConverter {
  protected serialization<T>(t: T): string {
    return JSON.stringify(t);
  }

  protected deserialization<T>(d: string): T {
    return JSON.parse(d);
  }

  protected serializeArray<T>(arr: T[]): string {
    return JSON.stringify(arr.map(item => JSON.stringify(item)));
  }

  protected deserializeArray<T>(d: string): T[] {
    return JSON.parse(d).map(item => JSON.parse(item));
  }

  protected array2string(arr: string[]): string {
    if (!arr) {
      return "";
    }
    return arr.join(",");
  }

  protected string2array(str: string): string[] {
    if (!str) {
      return str.split(",");
    }
    return [];
  }
}
