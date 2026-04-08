<script lang="ts">
    import ResetSettingsControls from "./ResetSettingsControls.svelte";
    import NotificationTestControls from "./NotificationTestControls.svelte";
    import { Bug } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";

    import type { DebugSettingsModel } from "@/entrypoints/popup/types";

    let { model }: { model: DebugSettingsModel } = $props();
</script>

<Section title="Developer" icon={Bug}>
    <ToggleControl
        title="Enable developer mode"
        description="Log extension activity to the browser console."
        value={model.settingsState.globals.enableDebug}
        onClick={model.onToggle}
    >
        {#snippet children()}
            <ResetSettingsControls
                activeSite={model.activeSite}
                settingsState={model.settingsState}
            />
            <NotificationTestControls activeSite={model.activeSite} />
        {/snippet}
    </ToggleControl>
</Section>
