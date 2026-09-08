import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  migrate?: (value: unknown) => T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;

      const parsed = JSON.parse(item);
      // Apply migration if provided
      return migrate ? migrate(parsed) : parsed;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Remember the JSON we most-recently wrote so the cross-tab `storage`
  // listener can skip echoes of our own writes.
  const lastSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(storedValue);
      lastSerializedRef.current = serialized;
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Cross-tab live sync: when the same key changes in another tab (or
  // window) of the same origin, adopt the new value. This is what makes
  // the projector-mode tab reflect edits made in the main scheduler
  // tab in real time, even when the project isn't in the cloud.
  //
  // The browser only fires the `storage` event in OTHER tabs, not the
  // one that wrote. Still guard by comparing against the last value we
  // ourselves wrote so a race with another framework or a manual
  // localStorage.setItem doesn't loop.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      if (event.storageArea !== window.localStorage) return;
      if (event.newValue === null) {
        // Key was cleared in another tab.
        setStoredValue(initialValue);
        return;
      }
      if (event.newValue === lastSerializedRef.current) return;
      try {
        const parsed = JSON.parse(event.newValue);
        const value = migrate ? migrate(parsed) : (parsed as T);
        lastSerializedRef.current = event.newValue;
        setStoredValue(value);
      } catch (err) {
        console.warn(`Error syncing localStorage key "${key}" from another tab:`, err);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // migrate + initialValue are captured on mount; changes to them
    // between renders shouldn't restart the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [storedValue, setStoredValue];
}
