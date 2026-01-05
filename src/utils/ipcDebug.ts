/**
 * IPC 监听器诊断工具
 * 用于开发环境下检测和调试 IPC 监听器泄漏问题
 */

import { ipcRenderer } from "electron";

interface ListenerStats {
    channel: string;
    count: number;
}

/**
 * 获取当前所有 IPC 监听器的统计信息
 */
export function getListenerStats(): ListenerStats[] {
    const stats: ListenerStats[] = [];

    // 获取所有已注册的事件名称
    const eventNames = ipcRenderer.eventNames() as string[];

    eventNames.forEach((eventName) => {
        const count = ipcRenderer.listenerCount(eventName);
        if (count > 0) {
            stats.push({
                channel: eventName,
                count: count
            });
        }
    });

    return stats.sort((a, b) => b.count - a.count);
}

/**
 * 打印监听器统计信息到控制台
 */
export function printListenerStats() {
    const stats = getListenerStats();

    console.group("📊 IPC Listener Statistics");
    console.table(stats);

    const warnings = stats.filter(s => s.count > 1);
    if (warnings.length > 0) {
        console.warn("⚠️ 检测到可能的监听器泄漏（多个监听器监听同一频道）:");
        console.table(warnings);
    }

    console.groupEnd();

    return stats;
}

/**
 * 检查是否存在监听器泄漏
 * @param threshold 监听器数量阈值，超过此值视为泄漏
 */
export function detectLeaks(threshold: number = 2): boolean {
    const stats = getListenerStats();
    const leaks = stats.filter(s => s.count > threshold);

    if (leaks.length > 0) {
        console.error("🔴 检测到监听器泄漏:");
        console.table(leaks);
        return true;
    }

    return false;
}

/**
 * 在开发环境下定期检查监听器
 */
export function startMonitoring(intervalMs: number = 5000) {
    if (import.meta.env.DEV) {
        console.log("🔍 启动 IPC 监听器监控...");

        const intervalId = setInterval(() => {
            const hasLeaks = detectLeaks();
            if (!hasLeaks) {
                console.log("✅ IPC 监听器状态正常");
            }
        }, intervalMs);

        // HMR 时清理
        if (import.meta.hot) {
            import.meta.hot.dispose(() => {
                clearInterval(intervalId);
                console.log("🛑 停止 IPC 监听器监控");
            });
        }

        return intervalId;
    }
}

// 在开发环境下，将工具挂载到 window 对象方便调试
if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as any).__ipcDebug = {
        getStats: getListenerStats,
        printStats: printListenerStats,
        detectLeaks,
        startMonitoring
    };

    console.log("💡 IPC 调试工具已加载。在控制台中使用:");
    console.log("  - window.__ipcDebug.printStats() 查看监听器统计");
    console.log("  - window.__ipcDebug.detectLeaks() 检测泄漏");
    console.log("  - window.__ipcDebug.startMonitoring() 开始监控");
}
