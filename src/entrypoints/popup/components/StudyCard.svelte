<script lang="ts">
    import { Clock } from "@lucide/svelte";
    import { DEVICE_META, PERIPHERAL_META } from "../lib/capabilitiesMeta";
    import {
        formatDuration,
        formatValue,
        formatTimeAgo,
    } from "../lib/formatters";
    import { popupSession } from "../popupSession.svelte";

    import type { StudyCardModel } from "../types";

    let { item }: StudyCardModel = $props();

    const MAX_VISIBLE_ICONS = 3;

    const highlighted = $derived(
        item.lastAlertableChangeAt > popupSession.seenAt &&
            item.matchesAlertRules,
    );

    const title = $derived(item.title ?? "Untitled study");
    const researcher = $derived(item.researcher ?? "Researcher unavailable");

    const reward = $derived(formatValue(item.reward, item.symbol));
    const rate = $derived(formatValue(item.rate, item.symbol));
    const averageCompletion = $derived(
        formatDuration(item.averageCompletionMinutes),
    );
    const accent = $derived(item.color ?? "rgb(100, 116, 139)");
    const cardStyle = $derived(`--accent: ${accent};`);

    const deviceCapabilities = $derived(
        item.devices.map((device) => ({
            key: device,
            ...DEVICE_META[device],
        })),
    );
    const peripheralCapabilities = $derived(
        item.peripherals.map((peripheral) => ({
            key: peripheral,
            ...PERIPHERAL_META[peripheral],
        })),
    );

    const allIcons = $derived([
        ...deviceCapabilities,
        ...peripheralCapabilities,
    ]);
    const overflowCount = $derived(
        Math.max(0, allIcons.length - MAX_VISIBLE_ICONS),
    );

    const timeAgo = $derived(formatTimeAgo(item.firstSeenAt));
</script>

{#snippet cardContent()}
    <div class="flex gap-3" style={cardStyle}>
        <div class="min-w-0 flex-1">
            <p
                class="flex items-center gap-1.25 text-[13px] font-semibold leading-snug text-popup-text-strong"
            >
                {#if highlighted}
                    <span class="relative inline-flex h-1.75 w-1.75 shrink-0">
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
                <span class="min-w-0 truncate">{title}</span>
            </p>

            <p class="mt-0.5 truncate text-[11.5px] text-popup-text-muted">
                {researcher}
                <span class="text-popup-text-faint">&middot;</span>
                {item.siteLabel}
            </p>

            <div class="mt-1.5 flex items-center gap-1.5">
                {#if averageCompletion}
                    <span
                        class="flex items-center gap-1 text-[11px] text-popup-text-muted"
                    >
                        <Clock
                            size={11}
                            strokeWidth={2}
                            class="text-popup-text-faint"
                        />
                        {averageCompletion}
                    </span>
                {/if}

                {#if averageCompletion && allIcons.length > 0}
                    <span class="h-2.5 w-px bg-popup-border"></span>
                {/if}

                {#if allIcons.length > 0}
                    <span
                        class="flex items-center gap-1"
                        aria-label="Required devices and peripherals"
                    >
                        {#each allIcons as capability, i (capability.key)}
                            {@const Icon = capability.icon}
                            <Icon
                                size={12}
                                strokeWidth={2}
                                class={`${i >= MAX_VISIBLE_ICONS ? "hidden group-hover/card:block group-focus/card:block" : ""} ${i < deviceCapabilities.length ? "text-popup-text-muted opacity-85" : "text-popup-text-muted opacity-70"}`}
                                title={capability.label}
                                aria-label={capability.label}
                            />
                        {/each}
                        {#if overflowCount > 0}
                            <span
                                class="rounded bg-popup-tag-bg px-1 py-px text-[9px] font-bold text-popup-text-faint group-hover/card:hidden group-focus/card:hidden"
                            >
                                +{overflowCount}
                            </span>
                        {/if}
                    </span>
                {/if}
            </div>
        </div>

        <div class="flex shrink-0 flex-col items-end justify-center gap-0.5">
            {#if timeAgo}
                <span class="text-[10px] text-popup-text-muted">{timeAgo}</span>
            {/if}
            <span
                class="text-[22px] font-bold leading-tight tracking-[-0.02em]"
                style="color: var(--accent);"
            >
                {reward}
            </span>
            <span
                class="rounded-[5px] px-1.5 py-px text-[10px] font-semibold"
                style="color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);"
            >
                {rate}/hr
            </span>
        </div>
    </div>
{/snippet}

{#if item.link}
    <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        class="group/card relative block rounded-xl border border-popup-border bg-popup-surface p-3 px-4 transition-all duration-150 hover:-translate-y-px hover:bg-popup-surface-muted hover:shadow-sm"
    >
        {@render cardContent()}
    </a>
{:else}
    <div
        class="group/card relative rounded-xl border border-popup-border bg-popup-surface p-3 px-4"
    >
        {@render cardContent()}
    </div>
{/if}
