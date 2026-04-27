<script lang="ts">
    import ResetSettingsControls from "./ResetSettingsControls.svelte";
    import NotificationTestControls from "./NotificationTestControls.svelte";
    import { Bug } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";

    import type { DebugSettingsModel } from "@/entrypoints/popup/types";

    let { model }: { model: DebugSettingsModel } = $props();

    function handleToggle() {
        void model.queueMutation("store-patch", {
            namespace: "globals",
            data: {
                debug: {
                    enabled: !model.settingsState.globals.debug.enabled,
                },
            },
        });
    }
</script>

<Section title="Developer" icon={Bug} tone="muted">
    <ToggleControl
        title="Developer mode"
        description="Log activity to browser console."
        value={model.settingsState.globals.debug.enabled}
        onClick={handleToggle}
    >
        {#snippet children()}
            <ResetSettingsControls
                activeSite={model.activeSite}
                settingsState={model.settingsState}
                queueMutation={model.queueMutation}
            />
            <NotificationTestControls activeSite={model.activeSite} />
        {/snippet}
    </ToggleControl>
</Section>
