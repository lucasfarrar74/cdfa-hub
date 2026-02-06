import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryOptions {
  maxHistory?: number;
}

interface UseHistoryReturn<T> {
  state: T;
  set: (newState: T, actionLabel?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  reset: (newPresent: T) => void;
  lastAction: string | null;
}

/**
 * Custom hook for managing state history with undo/redo functionality
 * @param initialState - The initial state value
 * @param options - Configuration options
 * @returns History state and control functions
 */
export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistory = 20 } = options;

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const lastActionRef = useRef<string | null>(null);

  const set = useCallback((newState: T, actionLabel?: string) => {
    setHistory(prev => {
      // Don't add to history if state hasn't changed
      if (JSON.stringify(prev.present) === JSON.stringify(newState)) {
        return prev;
      }

      const newPast = [...prev.past, prev.present];

      // Limit history size
      if (newPast.length > maxHistory) {
        newPast.shift();
      }

      lastActionRef.current = actionLabel || null;

      return {
        past: newPast,
        present: newState,
        future: [], // Clear future when new state is set
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const previousState = newPast.pop()!;

      lastActionRef.current = 'undo';

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      const nextState = newFuture.shift()!;

      lastActionRef.current = 'redo';

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory(prev => ({
      past: [],
      present: prev.present,
      future: [],
    }));
    lastActionRef.current = null;
  }, []);

  const reset = useCallback((newPresent: T) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
    lastActionRef.current = null;
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
    reset,
    lastAction: lastActionRef.current,
  };
}

/**
 * Simplified hook for tracking history of a specific state slice
 * Useful for integrating with existing state management
 */
export interface HistoryTracker<T> {
  push: (state: T, label?: string) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  historyLength: number;
  futureLength: number;
}

export function useHistoryTracker<T>(maxHistory = 20): HistoryTracker<T> {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const currentRef = useRef<T | null>(null);

  const push = useCallback((state: T, _label?: string) => {
    if (currentRef.current !== null) {
      setPast(prev => {
        const newPast = [...prev, currentRef.current!];
        if (newPast.length > maxHistory) {
          newPast.shift();
        }
        return newPast;
      });
    }
    currentRef.current = state;
    setFuture([]); // Clear future on new action
  }, [maxHistory]);

  const undo = useCallback((): T | null => {
    if (past.length === 0) return null;

    const newPast = [...past];
    const previousState = newPast.pop()!;

    setPast(newPast);
    if (currentRef.current !== null) {
      setFuture(prev => [currentRef.current!, ...prev]);
    }
    currentRef.current = previousState;

    return previousState;
  }, [past]);

  const redo = useCallback((): T | null => {
    if (future.length === 0) return null;

    const newFuture = [...future];
    const nextState = newFuture.shift()!;

    setFuture(newFuture);
    if (currentRef.current !== null) {
      setPast(prev => [...prev, currentRef.current!]);
    }
    currentRef.current = nextState;

    return nextState;
  }, [future]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
    currentRef.current = null;
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clear,
    historyLength: past.length,
    futureLength: future.length,
  };
}
