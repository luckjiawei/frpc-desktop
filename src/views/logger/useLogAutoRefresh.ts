import { onUnmounted, ref, watch } from "vue";

const AUTO_REFRESH_SECONDS = 10;

/** 日志自动刷新：开启后每 10 秒调用一次 reload，并提供倒计时用于展示 */
export const useLogAutoRefresh = (reload: () => void) => {
  const autoRefresh = ref(false);
  const countdown = ref(AUTO_REFRESH_SECONDS);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    countdown.value = AUTO_REFRESH_SECONDS;
  };

  watch(autoRefresh, enabled => {
    stop();
    if (!enabled) return;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        countdown.value = AUTO_REFRESH_SECONDS;
        reload();
      }
    }, 1000);
  });

  onUnmounted(stop);

  return { autoRefresh, countdown, stop };
};
