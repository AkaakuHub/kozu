import { useEffect, useState, useRef } from 'react';
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
  const saving = useRef(false);
  const sequence = useRef(0);
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

  useEffect(() => {
    if (!revision) return;
    const timer = setTimeout(() => {
      if (saving.current) return;
      const patch = pending.current;
      if (!Object.keys(patch).length) return;
      pending.current = {};
      const id = sequence.current;
      saving.current = true;
      void fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
        .then((response) => {
          if (!response.ok) throw new Error('設定をクラウドに保存できませんでした。');
        })
        .catch(() => {
          pending.current = { ...patch, ...pending.current };
          notify('設定をクラウドに保存できませんでした。');
        })
        .finally(() => {
          saving.current = false;
          if (id !== sequence.current) changed((value) => value + 1);
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [notify, revision]);
  return {
    preferences,
    update: (patch: Preferences) => {
      pending.current = { ...pending.current, ...patch };
      dirty.current = { ...dirty.current, ...patch };
      sequence.current++;
      set((old) => ({ ...old, ...patch }));
      changed((value) => value + 1);
    },
  };
}
