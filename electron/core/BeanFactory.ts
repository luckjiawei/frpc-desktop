/**
 * todo DI
 */
class BeanFactory {
  private static _beans: Map<string, any> = new Map<string, any>();

  private static registerBean(name: string, instance: any): void {
    if (!this._beans.has(name)) {
      this._beans.set(name, instance);
    }
  }

  public static getBean<T>(name: string): T {
    return this._beans.get(name);
  }

  public static hasBean(name: string): boolean {
    return this._beans.has(name);
  }

  public static clear(): void {
    this._beans.clear();
  }
}

export default BeanFactory;
