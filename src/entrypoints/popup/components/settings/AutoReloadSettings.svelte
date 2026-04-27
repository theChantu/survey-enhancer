<script lang="ts">
    import { RefreshCw } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { parsePositiveInt } from "@/lib/parse/parsePositiveInt";
    import Field from "@/components/Field.svelte";
    import { capitalize } from "@/lib/utils";

    import type { AutoReloadSettingsModel } from "../../types";

    let { model }: { model: AutoReloadSettingsModel } = $props();

    function handleToggle() {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                autoReload: {
                    enabled: !model.autoReload.enabled,
                },
            },
        });
    }

    function handleIntervalChange(
        key: "minInterval" | "maxInterval",
        value: number,
    ) {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                autoReload: {
                    [key]: value,
                },
            },
        });
    }
</script>

<Section title="Auto Reload" icon={RefreshCw}>
    <ToggleControl
        title="Auto reload"
        description={`Check for new studies in the background on ${capitalize(model.siteName)}.`}
        value={model.autoReload.enabled}
        onClick={handleToggle}
    >
        {#snippet children()}
            <Field label="Min interval (minutes)" id="min-interval">
                <input
                    id="min-interval"
                    type="number"
                    min="1"
                    step="1"
                    class="popup-control box-border"
                    value={model.autoReload.minInterval}
                    onchange={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        handleIntervalChange("minInterval", minutes);
                    }}
                />
            </Field>
            <Field label="Max interval (minutes)" id="max-interval">
                <input
                    id="max-interval"
                    type="number"
                    min="1"
                    step="1"
                    class="popup-control box-border"
                    value={model.autoReload.maxInterval}
                    onchange={(e) => {
                        const minutes = parsePositiveInt(e.currentTarget.value);
                        if (minutes === null) return;
                        handleIntervalChange("maxInterval", minutes);
                    }}
                />
            </Field>
        {/snippet}
    </ToggleControl>
</Section>
