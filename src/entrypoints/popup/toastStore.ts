import { get, writable } from "svelte/store";

type ToastAction = () => void | Promise<void>;

export interface ToastItem {
    id: string;
    message: string;
    actionLabel?: string;
    onAction?: ToastAction;
}

export const toasts = writable<ToastItem[]>([]);

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function createToastId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scheduleDismiss(id: string, durationMs: number) {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);

    timers.set(
        id,
        setTimeout(() => {
            dismissToast(id);
        }, durationMs),
    );
}

function showToastInternal(
    toast: Omit<ToastItem, "id"> & { id?: string; durationMs?: number },
) {
    const id = toast.id ?? createToastId();
    const { durationMs = 4000, ...rest } = toast;

    toasts.update((all) => [...all, { id, ...rest }]);
    scheduleDismiss(id, durationMs);
    return id;
}

export function showToast(message: string, durationMs = 4000) {
    return showToastInternal({ message, durationMs });
}

export function showActionToast(options: {
    message: string;
    actionLabel: string;
    onAction: ToastAction;
    durationMs?: number;
}) {
    return showToastInternal(options);
}

export function pauseToast(id: string) {
    const existing = timers.get(id);
    if (existing) {
        clearTimeout(existing);
        timers.delete(id);
    }
}

export function resumeToast(id: string, durationMs = 4000) {
    scheduleDismiss(id, durationMs);
}

export function dismissToast(id: string) {
    const existing = timers.get(id);
    if (existing) {
        clearTimeout(existing);
        timers.delete(id);
    }

    toasts.update((all) => all.filter((toast) => toast.id !== id));
}

export function runToastAction(id: string) {
    const toast = get(toasts).find((item) => item.id === id);
    if (!toast?.onAction) return;

    dismissToast(id);
    Promise.resolve(toast.onAction()).catch((error) => {
        console.error("Toast action failed:", error);
    });
}
