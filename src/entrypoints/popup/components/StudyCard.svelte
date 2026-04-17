<script lang="ts">
    import { DEVICE_META, PERIPHERAL_META } from "../lib/capabilitiesMeta";
    import { formatDuration, formatValue } from "../lib/formatters";
    import { popupSession } from "../popupSession.svelte";

    import type { StudyCardModel } from "../types";

    let { item }: StudyCardModel = $props();

    const isNew = $derived(item.firstSeenAt > popupSession.seenAt);

    const title = $derived(item.title ?? "Untitled study");
    const researcher = $derived(item.researcher ?? "Researcher unavailable");

    const reward = $derived(formatValue(item.reward, item.symbol));
    const rate = $derived(formatValue(item.rate, item.symbol));
    const averageCompletion = $derived(
        formatDuration(item.averageCompletionSeconds),
    );
    const slots = $derived(item.slots);
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
</script>

{#snippet cardContent()}
    <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1.5">
            {#if isNew}
                <span
                    class="relative inline-flex h-2 w-2 shrink-0"
                    title="New study"
                    aria-label="New study"
                >
                    <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style="background: var(--accent);"
                    ></span>
                    <span
                        class="relative inline-flex h-2 w-2 rounded-full"
                        style="background: var(--accent);"
                    ></span>
                </span>
            {/if}
            <p
                class="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-popup-text-strong"
            >
                {title}
            </p>
        </div>
        {#if averageCompletion || slots !== null}
            <p class="shrink-0 text-xs text-popup-text-faint tabular-nums">
                {#if averageCompletion}<span class="font-medium text-popup-text"
                        >{averageCompletion}</span
                    >{/if}
                {#if averageCompletion && slots !== null}
                    <span class="text-popup-text-faint">&middot;</span>
                {/if}
                {#if slots !== null}<span class="font-medium text-popup-text"
                        >{slots}</span
                    >
                    {slots === 1 ? "slot" : "slots"}{/if}
            </p>
        {/if}
    </div>

    <p class="mt-0.5 truncate text-xs text-popup-text-faint">
        {researcher}
        <span class="text-popup-text-faint">&middot;</span>
        {item.siteLabel}
    </p>

    <div
        class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-popup-text"
    >
        <span
            class="rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums"
            style="color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);"
        >
            {reward}
            <span class="opacity-60">·</span>
            {rate}<span class="font-normal opacity-70">/hr</span>
        </span>

        {#if deviceCapabilities.length > 0 || peripheralCapabilities.length > 0}
            <span
                class="ml-auto inline-flex items-center gap-1 text-popup-text-soft"
            >
                {#each deviceCapabilities as capability (capability.key)}
                    {@const Icon = capability.icon}
                    <Icon
                        class="h-3.5 w-3.5 shrink-0"
                        strokeWidth={2}
                        title={capability.label}
                        aria-label={capability.label}
                    />
                {/each}
                {#if deviceCapabilities.length > 0 && peripheralCapabilities.length > 0}
                    <span class="text-popup-text-faint">&middot;</span>
                {/if}
                {#each peripheralCapabilities as capability (capability.key)}
                    {@const Icon = capability.icon}
                    <Icon
                        class="h-3.5 w-3.5 shrink-0"
                        strokeWidth={2}
                        title={capability.label}
                        aria-label={capability.label}
                    />
                {/each}
            </span>
        {/if}
    </div>
{/snippet}

{#if item.link}
    <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        class="popup-surface block border-l-4 p-3 transition-[background-color,box-shadow] duration-150 hover:bg-popup-surface-muted hover:shadow-[inset_4px_0_0_0_var(--accent)]"
        style="{cardStyle} border-left-color: var(--accent);"
    >
        {@render cardContent()}
    </a>
{:else}
    <div
        class="popup-surface border-l-4 p-3"
        style="{cardStyle} border-left-color: var(--accent);"
    >
        {@render cardContent()}
    </div>
{/if}
