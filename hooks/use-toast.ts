'use client';

import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 1;

// Default durations (ms)
const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;

// After a toast is dismissed (open=false), remove it after this delay.
// Keep small; UI animation usually finishes within 150–300ms.
const TOAST_REMOVE_DELAY = 300;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;

  // New: per-toast auto-dismiss duration
  duration?: number;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType['ADD_TOAST']; toast: ToasterToast }
  | { type: ActionType['UPDATE_TOAST']; toast: Partial<ToasterToast> & { id: string } }
  | { type: ActionType['DISMISS_TOAST']; toastId?: ToasterToast['id'] }
  | { type: ActionType['REMOVE_TOAST']; toastId?: ToasterToast['id'] };

interface State {
  toasts: ToasterToast[];
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/**
 * Timers:
 * - dismissTimers: auto-dismiss after duration
 * - removeTimers: remove after TOAST_REMOVE_DELAY once dismissed
 */
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
const removeTimers = new Map<string, ReturnType<typeof setTimeout>>();

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          toastId === undefined || t.id === toastId
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
};

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function clearTimer(map: Map<string, ReturnType<typeof setTimeout>>, id: string) {
  const t = map.get(id);
  if (t) {
    clearTimeout(t);
    map.delete(id);
  }
}

function scheduleAutoDismiss(toastId: string, duration: number | undefined) {
  // duration 0 or Infinity disables auto dismiss
  if (duration === 0 || duration === Infinity) return;

  clearTimer(dismissTimers, toastId);

  const ms = typeof duration === 'number' ? duration : DEFAULT_DURATION;
  const timeout = setTimeout(() => {
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
  }, ms);

  dismissTimers.set(toastId, timeout);
}

function scheduleRemove(toastId: string) {
  clearTimer(removeTimers, toastId);

  const timeout = setTimeout(() => {
    removeTimers.delete(toastId);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, TOAST_REMOVE_DELAY);

  removeTimers.set(toastId, timeout);
}

type ToastInput = Omit<ToasterToast, 'id' | 'open' | 'onOpenChange'>;

function toast(input: ToastInput) {
  const id = genId();

  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  const update = (next: Partial<ToastInput>) => {
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { id, ...next },
    });

    // if duration updated, reschedule
    if ('duration' in next) scheduleAutoDismiss(id, next.duration);
  };

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...input,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  // Start auto-dismiss timer
  scheduleAutoDismiss(id, input.duration);

  return { id, dismiss, update };
}

// Optional helpers (keep if you like)
toast.success = (props: ToastInput) =>
  toast({ ...props, variant: props.variant ?? 'default', duration: props.duration ?? DEFAULT_DURATION });

toast.error = (props: ToastInput) =>
  toast({ ...props, variant: props.variant ?? 'destructive', duration: props.duration ?? ERROR_DURATION });

toast.info = (props: ToastInput) =>
  toast({ ...props, variant: props.variant ?? 'default', duration: props.duration ?? DEFAULT_DURATION });

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
    // ✅ important: no [state] dependency
  }, []);

  // When a toast is dismissed, schedule its removal
  React.useEffect(() => {
    state.toasts.forEach((t) => {
      if (t.open === false) {
        clearTimer(dismissTimers, t.id);
        scheduleRemove(t.id);
      }
    });
  }, [state.toasts]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) {
        dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
      } else {
        dispatch({ type: actionTypes.DISMISS_TOAST });
      }
    },
  };
}

export { useToast, toast };
