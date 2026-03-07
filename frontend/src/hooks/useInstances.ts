import { useEffect, useRef } from 'react';
import { useInstanceStore } from '../stores/instance-store.js';
import { fetchInstances } from '../services/instance-api.js';

const POLL_INTERVAL_MS = 5000;

/**
 * 每 5 秒轮询 /api/instances，更新 instance-store。
 * 首次加载自动选中 isCurrent 实例。
 */
export function useInstances() {
  const setInstances = useInstanceStore((s) => s.setInstances);
  const setActiveInstanceId = useInstanceStore((s) => s.setActiveInstanceId);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const initializedRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const instances = await fetchInstances();
        if (cancelled) return;
        setInstances(instances);

        // 首次加载：如果没有选中的实例，自动选中 isCurrent 实例
        if (!initializedRef.current && instances.length > 0) {
          initializedRef.current = true;
          const currentActive = useInstanceStore.getState().activeInstanceId;
          if (!currentActive) {
            const current = instances.find(i => i.isCurrent) ?? instances[0];
            if (current) {
              setActiveInstanceId(current.instanceId);
            }
          }
        }

      } catch {
        // 轮询失败时静默处理（可能未认证）
      }
    };

    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [setInstances, setActiveInstanceId]);

  return { activeInstanceId };
}
