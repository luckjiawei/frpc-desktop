declare module 'element-plus/dist/locale/zh-cn.mjs' {
    const zhLocale: any;
    export default zhLocale;
}

declare module 'element-plus/dist/locale/en.mjs' {
    const enLocale: any;
    export default enLocale;
}

declare global {
    /**
     * 本地端口类型
     */
    type LocalPort = {
        protocol: string;
        ip: string;
        port: number;
    }
}
export { };