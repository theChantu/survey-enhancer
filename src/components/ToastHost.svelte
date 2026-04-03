<script lang="ts">
    import {
        dismissToast,
        pauseToast,
        resumeToast,
        runToastAction,
        toasts,
    } from "@/entrypoints/popup/toastStore";
</script>

<div
    class="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(320px,calc(100vw-1.5rem))] flex-col gap-2"
>
    {#each $toasts as toast (toast.id)}
        <div
            class="pointer-events-auto flex items-center gap-2 rounded-md border border-white/10 bg-[#1c2127]/95 px-3 py-2 text-[0.78rem] leading-snug text-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur"
            role="alert"
            on:mouseenter={() => pauseToast(toast.id)}
            on:mouseleave={() => resumeToast(toast.id)}
        >
            <span class="min-w-0 flex-1">{toast.message}</span>

            {#if toast.actionLabel}
                <button
                    class="shrink-0 cursor-pointer rounded border-none bg-transparent p-0 text-[0.72rem] font-semibold text-indigo-300 transition-colors hover:text-indigo-200"
                    on:click={() => runToastAction(toast.id)}
                >
                    {toast.actionLabel}
                </button>
            {/if}

            <button
                class="shrink-0 cursor-pointer rounded border-none bg-transparent p-0 text-[0.85rem] leading-none text-gray-500 transition-colors hover:text-gray-300"
                on:click={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    {/each}
</div>
