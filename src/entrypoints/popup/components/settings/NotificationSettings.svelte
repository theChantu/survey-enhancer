<script lang="ts">
    import { Bell } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { cleanResearcherName } from "@/lib/utils";
    import TagInput from "@/components/TagInput.svelte";

    import type { NotificationSettingsModel } from "../../types";

    let { model }: { model: NotificationSettingsModel } = $props();
</script>

<Section title="Alerts" icon={Bell}>
    <ToggleControl
        title="New survey alerts"
        description="Send a desktop notification when a new survey appears."
        value={model.newSurveyNotifications.enabled}
        onClick={model.onToggle}
    >
        {#snippet children()}
            <TagInput
                title="Included researchers"
                values={model.newSurveyNotifications.includedResearchers}
                suggestions={Object.keys(
                    model.newSurveyNotifications.cachedResearchers,
                )}
                placeholder="Add researcher..."
                clean={cleanResearcherName}
                onAdd={model.onAddIncluded}
                onRemove={model.onRemoveIncluded}
            />
            <TagInput
                title="Excluded researchers"
                values={model.newSurveyNotifications.excludedResearchers}
                suggestions={Object.keys(
                    model.newSurveyNotifications.cachedResearchers,
                )}
                placeholder="Add researcher..."
                clean={cleanResearcherName}
                onAdd={model.onAddExcluded}
                onRemove={model.onRemoveExcluded}
            />
        {/snippet}
    </ToggleControl>
</Section>
