import { useEffect, useRef } from 'react';
import { useInstanceStore } from '../stores/instance-store.js';
import { useAppStore } from '../stores/app-store.js';
import { fetchInstances } from '../services/instance-api.js';

const POLL_INTERVAL_MS = 5000;

/**
 * 每 5 秒轮询 /api/instances，更新 instance-store。
 * 首次加载自动选中 isCurrent 实例。
 * 同时更新 serverAvailable 状态以区分"无实例"和"服务器不可用"。
 */
export function useInstances() {
  const setInstances = useInstanceStore((s) => s.setInstances);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);
  const setServerAvailable = useAppStore((s) => s.setServerAvailable);
  const initializedRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const instances = await fetchInstances();
        if (cancelled) return;

        setServerAvailable(true);
        setInstances(instances);

        // 自动选中逻辑：没有活跃实例 或 活跃实例不在新列表中 → 自动选中
        const currentActive = useInstanceStore.getState().activeInstanceId;
        const activeStillExists = currentActive && instances.some(i => i.instanceId === currentActive);
        if ((!currentActive || !activeStillExists) && instances.length > 0) {
          const current = instances.find(i => i.isCurrent) ?? instances[0];
          if (current) {
            setActiveInstanceId(current.instanceId);
          }
        }

      } catch {
        if (cancelled) return;
        setServerAvailable(false);
        setInstances([]);  // 清理 stale instances，阻止 auto-switch ping-pong
      }
    };

    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [setInstances, setActiveInstanceId, setServerAvailable]);

  // 返回 activeInstanceId 以便使用此 hook 的组件能获取当前值
  return { activeInstanceId: useInstanceStore((s) => s.activeInstanceId) };
}
