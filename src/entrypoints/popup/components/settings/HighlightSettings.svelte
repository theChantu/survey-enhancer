<script lang="ts">
    import { Highlighter } from "@lucide/svelte";
    import RangeInput from "@/components/RangeInput.svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { HIGHLIGHT_BASE_CURRENCY } from "@/constants";
    import { getCurrencySymbol } from "@/lib/currency";

    import type { HighlightSettingsModel } from "../../types";
    import type { GlobalSettings } from "@/store/types";

    let { model }: { model: HighlightSettingsModel } = $props();

    function handleToggle() {
        void model.queueMutation("store-patch", {
            namespace: "globals",
            data: {
                highlightRates: {
                    enabled: !model.highlightRates.enabled,
                },
            },
        });
    }

    function handleRateChange(
        type: keyof Omit<GlobalSettings["highlightRates"], "enabled">,
        e: Event,
    ) {
        const value = Number((e.target as HTMLInputElement).value);
        void model.queueMutation("store-patch", {
            namespace: "globals",
            data: {
                highlightRates: {
                    [type]: value,
                },
            },
        });
    }

    const targetCurrencySymbol = $derived(
        getCurrencySymbol(model.currency.target) ?? model.currency.target,
    );

    const baseRates = $derived(model.conversionRates[HIGHLIGHT_BASE_CURRENCY]);

    const targetRate = $derived(baseRates?.rates[model.currency.target]);

    const showConvertedThresholds = $derived(
        model.currency.enabled &&
            model.currency.target !== HIGHLIGHT_BASE_CURRENCY &&
            (baseRates?.timestamp ?? 0) > 0 &&
            typeof targetRate === "number",
    );

    function formatConvertedThreshold(value: number): string | null {
        const rate = targetRate;
        if (!showConvertedThresholds || typeof rate !== "number") return null;

        return `≈ ${targetCurrencySymbol}${(value * rate).toFixed(2)}`;
    }

    function formatUsdThreshold(value: number): string {
        return `$${value}/hr`;
    }

    const lowRateMax = $derived(Math.min(model.highlightRates.max - 1, 40));
    const strongRateMin = $derived(Math.max(model.highlightRates.min + 1, 2));
</script>

<Section title="Highlights" icon={Highlighter}>
    <ToggleControl
        title="Rate highlights"
        description="Highlight studies by hourly rate."
        value={model.highlightRates.enabled}
        onClick={handleToggle}
    >
        <div class="flex flex-col gap-1">
            <RangeInput
                label={`Low rate — dimmed below (${formatUsdThreshold(model.highlightRates.min)})`}
                min={1}
                max={lowRateMax}
                value={model.highlightRates.min}
                oninput={(e) => handleRateChange("min", e)}
            />
            {#if formatConvertedThreshold(model.highlightRates.min)}
                <span class="text-[11px] text-popup-text-faint">
                    {formatConvertedThreshold(model.highlightRates.min)}
                </span>
            {/if}
        </div>
        <div class="flex flex-col gap-1">
            <RangeInput
                label={`Strong rate — fully highlighted above (${formatUsdThreshold(model.highlightRates.max)})`}
                min={strongRateMin}
                max={100}
                value={model.highlightRates.max}
                oninput={(e) => handleRateChange("max", e)}
            />
            {#if formatConvertedThreshold(model.highlightRates.max)}
                <span class="text-[11px] text-popup-text-faint">
                    {formatConvertedThreshold(model.highlightRates.max)}
                </span>
            {/if}
        </div>
    </ToggleControl>
</Section>
