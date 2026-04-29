<script lang="ts">
    import { Sparkles, X } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import { latestChangelogEntry } from "@/lib/changelog";
    import { settingsState } from "../state.svelte";
    import { queueMutation } from "../popupModel.svelte";
    import { popupSession } from "../popupSession.svelte";

    const entry = latestChangelogEntry;
    const visible = $derived(
        popupSession.ready &&
            entry !== null &&
            settingsState.globals.changelogLastSeenVersion !== entry.version,
    );

    function dismiss() {
        if (!entry) return;

        settingsState.globals.changelogLastSeenVersion = entry.version;
        void queueMutation("store-patch", {
            namespace: "globals",
            data: {
                changelogLastSeenVersion: entry.version,
            },
        });
    }

</script>

{#if visible && entry}
    <div class="shrink-0 px-5" transition:slide={{ duration: 150 }}>
        <section
            role="status"
            class="popup-surface border border-popup-accent-border bg-popup-accent-surface p-3 px-4"
        >
            <div class="flex items-start gap-3">
                <span
                    class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-popup-accent-surface-strong text-popup-accent-text"
                >
                    <Sparkles size={15} strokeWidth={2.2} />
                </span>

                <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <h2
                                class="text-sm font-semibold leading-snug text-popup-text-strong"
                            >
                                What's new in {entry.version}
                            </h2>
                            <p class="mt-0.5 text-xs text-popup-text-muted">
                                {entry.title}
                            </p>
                        </div>

                        <button
                            type="button"
                            class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-popup-text-faint hover:text-popup-text-soft"
                            aria-label="Dismiss changelog"
                            onclick={dismiss}
                        >
                            <X size={14} strokeWidth={2.2} />
                        </button>
                    </div>

                    <ul
                        class="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-popup-text"
                    >
                        {#each entry.items as item}
                            <li>{item}</li>
                        {/each}
                    </ul>
                </div>
            </div>
        </section>
    </div>
{/if}
