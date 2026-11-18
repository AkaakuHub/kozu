import { useCallback, useEffect, useState, useRef } from 'react';
import { parsePreferences } from '../../core/preferences.ts';
import type { Preferences } from '../../core/preferences.ts';

const key = 'kozu-preferences';
export function usePreferences(notify: (message: string) => void) {
  const [preferences, set] = useState<Preferences>(() => {
    try {
      return parsePreferences(JSON.parse(localStorage.getItem(key) ?? '{}'));
    } catch {
      return {};
    }
  });
  const pending = useRef<Preferences>({});
  const dirty = useRef<Preferences>({});
  const saving = useRef<Promise<void> | null>(null);
  const [revision, changed] = useState(0);
  useEffect(() => {
    let live = true;
    void fetch('/api/preferences', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const saved = parsePreferences(await response.json());
        if (live) set((local) => ({ ...local, ...saved, ...dirty.current }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch {
      /* Cloud settings are independent of local storage availability. */
    }
  }, [preferences]);

  const flush = useCallback(async () => {
    while (saving.current || Object.keys(pending.current).length) {
      if (!saving.current) {
        const patch = pending.current;
        pending.current = {};
        saving.current = fetch('/api/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          keepalive: true,
        })
          .then((response) => {
            if (!response.ok) throw new Error('設定をクラウドに保存できませんでした。');
          })
          .catch(() => {
            pending.current = { ...patch, ...pending.current };
            throw new Error('設定をクラウドに保存できませんでした。');
          })
          .finally(() => {
            saving.current = null;
          });
      }
      await saving.current;
    }
  }, []);
  useEffect(() => {
    if (!revision) return;
    const timer = setTimeout(
      () => void flush().catch((error: Error) => notify(error.message)),
      450,
    );
    return () => clearTimeout(timer);
  }, [flush, notify, revision]);
  return {
    preferences,
    flush,
    update: (patch: Preferences) => {
      pending.current = { ...pending.current, ...patch };
      dirty.current = { ...dirty.current, ...patch };
      set((old) => ({ ...old, ...patch }));
      changed((value) => value + 1);
    },
  };
}
