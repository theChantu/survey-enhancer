<script lang="ts">
    import { FolderKanban } from "@lucide/svelte";
    import { popupSession } from "../popupSession.svelte";

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
            : `${count} ${count === 1 ? "study" : "studies"} available`,
    );
</script>

{#snippet cardContent()}
    <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-2">
            <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-popup-accent-surface text-popup-accent-text"
            >
                <FolderKanban size={15} strokeWidth={2.2} />
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-1.5">
                    {#if highlighted}
                        <span
                            class="relative inline-flex h-2 w-2 shrink-0"
                            title="Matches your alert rules"
                            aria-label="Matches your alert rules"
                        >
                            <span
                                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-popup-accent-indicator opacity-75"
                            ></span>
                            <span
                                class="relative inline-flex h-2 w-2 rounded-full bg-popup-accent-indicator"
                            ></span>
                        </span>
                    {/if}
                    <p
                        class="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-popup-text-strong"
                    >
                        {title}
                    </p>
                </div>
                <p class="mt-0.5 truncate text-xs text-popup-text-faint">
                    Project · {item.siteLabel}
                </p>
            </div>
        </div>

        <span
            class="shrink-0 rounded-md bg-popup-accent-surface px-2 py-1 text-xs font-semibold text-popup-accent-text tabular-nums"
        >
            {countLabel}
        </span>
    </div>
{/snippet}

{#if item.link}
    <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        class="popup-surface block border-l-4 border-popup-accent-indicator p-3 transition-[background-color,box-shadow] duration-150 hover:bg-popup-surface-muted"
    >
        {@render cardContent()}
    </a>
{:else}
    <div class="popup-surface border-l-4 border-popup-accent-indicator p-3">
        {@render cardContent()}
    </div>
{/if}
