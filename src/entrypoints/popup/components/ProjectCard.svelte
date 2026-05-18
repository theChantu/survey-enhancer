<script lang="ts">
    import { Folder } from "@lucide/svelte";
    import { popupSession } from "../popupSession.svelte";
    import { formatTimeAgo } from "../lib/formatters";

    import type { ProjectItem } from "../types";

    let { item }: { item: ProjectItem } = $props();

    const highlighted = $derived(
        item.lastAlertableChangeAt > popupSession.seenAt &&
            item.matchesAlertRules,
    );
    const title = $derived(item.title ?? "Untitled project");
    const count = $derived(item.availableStudyCount);
    const countLabel = $derived(
        count === null
            ? "Studies available"
            : `${count} ${count === 1 ? "study" : "studies"}`,
    );
    const timeAgo = $derived(formatTimeAgo(item.firstSeenAt));
</script>

<div
    class="relative flex gap-3 rounded-xl border border-popup-border bg-popup-surface p-3 px-4"
>
    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
            {#if highlighted}
                <span
                    class="relative inline-flex h-1.75 w-1.75 shrink-0"
                    title="Matches your alert rules"
                    aria-label="Matches your alert rules"
                >
                    <span
                        class="absolute inset-0 rounded-full animate-ping-dot opacity-75"
                        style="background: var(--color-popup-new-dot);"
                    ></span>
                    <span
                        class="relative block h-1.75 w-1.75 rounded-full"
                        style="background: var(--color-popup-new-dot);"
                    ></span>
                </span>
            {/if}
            <Folder
                size={12}
                strokeWidth={2.5}
                class="text-popup-accent-text"
            />
            <span
                class="text-[10px] font-semibold uppercase tracking-[0.04em] text-popup-accent-text"
            >
                Project
            </span>
        </div>

        <p
            class="mt-1 truncate text-[13px] font-semibold leading-snug text-popup-text-strong"
        >
            {title}
        </p>

        <div
            class="mt-1 flex items-center gap-1.5 text-[11px] text-popup-text-muted"
        >
            <span>{item.siteLabel}</span>
            <span class="h-2.5 w-px bg-popup-border"></span>
            <span>{countLabel}</span>
        </div>
    </div>

    <div class="flex shrink-0 flex-col items-end justify-center">
        {#if timeAgo}
            <span class="text-[10px] text-popup-text-muted">{timeAgo}</span>
        {/if}
    </div>
</div>
