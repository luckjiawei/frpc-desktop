import log from "electron-log/main";

class BeanFactory {
  private static _beans: Map<string, any> = new Map<string, any>();

  /**
   * Register a bean with the given name and instance.
   * @param name The name to register the bean under
   * @param bean The bean instance to register
   */
  public static register(name: string, bean: any): void {
    this._beans.set(name, bean);
    log.scope("core").info(`Bean [${name}] initialized successfully.`);
  }

  /**
   * Register a bean instance with an auto-generated name.
   * If a bean with the same name already exists, a suffix will be appended to make it unique.
   * @param bean The bean instance to register
   */
  public static registerInstance<T>(bean: T): void {
    const name = this.getBeanName(bean.constructor.name);
    
    let suffix = 1;
    let finalName = name;
    while (this.hasBean(finalName)) {
      finalName = `${name}_${suffix}`;
      suffix++;
    }
    
    this.register(finalName, bean);
  }

  /**
   * Get a bean by its name.
   * @param name The name of the bean to retrieve
   * @returns The bean instance, or undefined if not found
   */
  public static getBean<T>(name: string): T {
    return this._beans.get(name);
  }

  /**
   * Check if a bean with the given name exists.
   * @param name The name of the bean to check
   * @returns true if the bean exists, false otherwise
   */
  public static hasBean(name: string): boolean {
    return this._beans.has(name);
  }

  /**
   * Clear all registered beans.
   */
  public static clear(): void {
    this._beans.clear();
  }

  /**
   * Get the camelCase name for a class.
   * @param className The name of the class
   * @returns The camelCase version of the class name
   */
  public static getBeanName(className: string): string {
    return className.charAt(0).toLowerCase() + className.slice(1);
  }
}

export default BeanFactory;
