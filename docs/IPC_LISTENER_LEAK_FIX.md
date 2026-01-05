# IPC 监听器泄漏问题解决方案

## 问题描述

在开发 Electron + Vue 应用时，使用 HMR（热模块替换）会导致渲染进程卡住。这是因为每次代码修改后：

1. Vue 组件重新加载，`onMounted` 再次执行
2. IPC 监听器被重复注册
3. 旧的监听器没有被清理
4. 监听器累积导致内存泄漏和性能下降

## 解决方案

### 1. 改进的 IPC 工具 (`src/utils/ipcUtils.ts`)

#### 新功能

- **监听器引用管理**: 使用 `Map` 存储所有监听器引用
- **精确清理**: 可以精确移除特定监听器，而不是粗暴地移除所有监听器
- **HMR 自动清理**: 在模块热更新时自动清理所有监听器
- **返回清理函数**: `on()` 和 `onEvent()` 现在返回清理函数，可选使用

#### 使用示例

```typescript
// 基本用法（推荐）
import { on, removeRouterListeners } from "@/utils/ipcUtils";

onMounted(() => {
  on(IPCChannels.VERSION_GET_VERSIONS, data => {
    // 处理数据
  });
});

onUnmounted(() => {
  removeRouterListeners(IPCChannels.VERSION_GET_VERSIONS);
});

// 高级用法：使用返回的清理函数
onMounted(() => {
  const cleanup = on(IPCChannels.VERSION_GET_VERSIONS, data => {
    // 处理数据
  });

  // 可以在任何时候调用清理函数
  onUnmounted(() => {
    cleanup();
  });
});
```

### 2. IPC 调试工具 (`src/utils/ipcDebug.ts`)

在开发环境下自动启用，提供以下功能：

#### 控制台命令

```javascript
// 查看所有 IPC 监听器统计
window.__ipcDebug.printStats();

// 检测监听器泄漏
window.__ipcDebug.detectLeaks();

// 开始定期监控（每 5 秒）
window.__ipcDebug.startMonitoring(5000);
```

#### 自动监控

在 `main.ts` 中已启用自动监控，每 10 秒检查一次监听器状态。

### 3. 最佳实践

#### ✅ 正确做法

```typescript
// versions/index.ts
export function useVersions() {
  onMounted(() => {
    on(IPCChannels.VERSION_GET_VERSIONS, data => {
      versions.value = data;
    });
  });

  onUnmounted(() => {
    // 务必清理监听器
    removeRouterListeners(IPCChannels.VERSION_GET_VERSIONS);
  });
}
```

#### ❌ 错误做法

```typescript
// 不要在 onMounted 外注册监听器
on(IPCChannels.VERSION_GET_VERSIONS, data => {
  versions.value = data;
});

// 不要忘记在 onUnmounted 中清理
onMounted(() => {
  on(IPCChannels.VERSION_GET_VERSIONS, data => {
    versions.value = data;
  });
});
// 缺少 onUnmounted 清理！
```

### 4. 排查步骤

如果仍然遇到卡顿问题：

1. **打开开发者工具控制台**
2. **运行诊断命令**:
   ```javascript
   window.__ipcDebug.printStats();
   ```
3. **查看输出**:
   - 如果某个频道的监听器数量 > 1，说明存在泄漏
   - 重点关注 `count` 列，数值越大问题越严重

4. **定位问题组件**:
   - 找到泄漏的频道名称
   - 在代码中搜索该频道
   - 检查对应组件的 `onUnmounted` 是否正确清理

5. **验证修复**:
   - 修改代码后，再次运行 `window.__ipcDebug.printStats()`
   - 确认监听器数量恢复正常

## 技术细节

### HMR 自动清理机制

```typescript
// ipcUtils.ts 中的 HMR 清理
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log("[HMR] Cleaning up IPC listeners...");
    removeAllRouterListeners();
  });
}
```

这段代码确保在 Vite HMR 触发时自动清理所有监听器，防止累积。

### 监听器引用管理

```typescript
// 使用 Map + Set 存储监听器引用
const listenerMap = new Map<string, Set<IpcListener>>();

// 注册时保存引用
listenerMap.get(channel)!.add(listener);

// 清理时精确移除
ipcRenderer.removeListener(channel, listener);
```

## 常见问题

**Q: 为什么不直接用 `removeAllListeners`？**  
A: `removeAllListeners` 会移除所有监听器，包括可能由其他模块注册的。精确清理更安全。

**Q: HMR 清理会影响生产环境吗？**  
A: 不会。`import.meta.hot` 只在开发环境下存在，生产构建时会被移除。

**Q: 调试工具会影响性能吗？**  
A: 调试工具只在开发环境下加载，定期检查的开销很小（< 1ms）。

## 更新日志

- 2026-01-05:
  - 重构 `ipcUtils.ts`，添加监听器引用管理
  - 创建 `ipcDebug.ts` 调试工具
  - 在 `main.ts` 中启用自动监控
  - 添加 HMR 自动清理机制
