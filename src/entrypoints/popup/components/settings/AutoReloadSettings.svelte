<script lang="ts">
    import { RefreshCw } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { parsePositiveInt } from "@/lib/parsePositiveInt";
    import Field from "@/components/Field.svelte";

    import type { AutoReloadSettingsModel } from "../../types";

    let { model }: { model: AutoReloadSettingsModel } = $props();
</script>

<Section title="Auto reload" icon={RefreshCw}>
    <ToggleControl
        title="Auto reload"
        description="Periodically refresh the page in the background to check for new studies."
        value={model.autoReload.enabled}
        onClick={model.onToggle}
    >
        {#snippet children()}
            <Field label="Min interval (minutes)" id="min-interval">
                <input
                    id="min-interval"
                    type="number"
                    min="1"
                    step="1"
                    class="w-full rounded-md border border-white/8 bg-white/4 px-3 py-2.5 text-[0.82rem] font-[inherit] text-gray-200 outline-none box-border transition-colors duration-150 hover:bg-white/5 focus:border-white/18"
                    value={model.autoReload.minInterval}
                    onchange={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        model.onIntervalChange("minInterval", minutes);
                    }}
                />
            </Field>
            <Field label="Max interval (minutes)" id="max-interval">
                <input
                    id="max-interval"
                    type="number"
                    min="1"
                    step="1"
                    class="w-full rounded-md border border-white/8 bg-white/4 px-3 py-2.5 text-[0.82rem] font-[inherit] text-gray-200 outline-none box-border transition-colors duration-150 hover:bg-white/5 focus:border-white/18"
                    value={model.autoReload.maxInterval}
                    onchange={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        model.onIntervalChange("maxInterval", minutes);
                    }}
                />
            </Field>
        {/snippet}
    </ToggleControl>
</Section>
