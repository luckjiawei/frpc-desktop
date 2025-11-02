import Logger from "./Logger";

class BeanFactory {
  private static _beans: Map<string, any> = new Map<string, any>();

  static registerBean(clazz: Function, beanName?: string): void {
    if (!beanName) {
      beanName = this.getBeanName(clazz.name);
    }
    if (this.hasBean(beanName)) {
      return;
    }
    const instance = new (clazz as any)();
    this._beans.set(beanName, instance);
  }

  public static setBean<T>(name: string, bean: T): void {
    this._beans.set(name, bean);
    Logger.info(`${this.name}.${arguments[0]}`, `register bean ${name}`);
    // Logger.info(`register bean ${name} ${bean}`);
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

  public static getBeanName(className: string) {
    return className.charAt(0).toLowerCase() + className.slice(1);
  }
}

export default BeanFactory;
