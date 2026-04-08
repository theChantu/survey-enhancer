<script lang="ts">
    import { Highlighter } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";

    import type { HighlightSettingsModel } from "../../types";

    let { model }: { model: HighlightSettingsModel } = $props();
</script>

<Section title="Highlights" icon={Highlighter}>
    <ToggleControl
        title="Rate highlights"
        description="Visually emphasize stronger survey rates."
        value={model.highlightRates.enabled}
        onClick={model.onToggle}
    ></ToggleControl>
</Section>
