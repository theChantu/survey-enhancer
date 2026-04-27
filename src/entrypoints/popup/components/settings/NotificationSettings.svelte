<script lang="ts">
    import { Bell } from "@lucide/svelte";
    import Field from "@/components/Field.svelte";
    import RangeInput from "@/components/RangeInput.svelte";
    import SelectControl from "@/components/SelectControl.svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { capitalize } from "@/lib/utils";
    import type {
        DeepPartial,
        GlobalSettings,
        NotificationSound,
        SiteSettings,
    } from "@/store/types";
    import { playSound } from "@/lib/playSound";
    import AlertRuleGroupEditor from "./AlertRuleGroupEditor.svelte";

    import type {
        AlertRuleGroup,
        AlertRules,
    } from "@/lib/notifications/alertRules";
    import type { NotificationSettingsModel } from "../../types";

    let { model }: { model: NotificationSettingsModel } = $props();

    let ruleSuggestions = $derived({
        kind: ["study", "project"],
        researcher: Object.keys(model.opportunityAlerts.cache.researchers),
        title: Object.keys(model.opportunityAlerts.cache.titles),
    });

    const notificationSounds = [
        "alert",
        "bloop",
        "chime",
    ] as const satisfies NotificationSound[];

    function patchGlobalNotifications(
        data: DeepPartial<GlobalSettings["notifications"]>,
    ) {
        void model.queueMutation("store-patch", {
            namespace: "globals",
            data: {
                notifications: data,
            },
        });
    }

    function patchSiteNotifications(
        data: DeepPartial<SiteSettings["opportunityAlerts"]>,
    ) {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                opportunityAlerts: data,
            },
        });
    }

    function updateRuleGroup(key: keyof AlertRules, group: AlertRuleGroup) {
        const rules = $state.snapshot(model.opportunityAlerts.rules);

        patchSiteNotifications({
            rules: {
                ...rules,
                [key]: group,
            },
        });
    }

    function onVolumeChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const value = Number(input.value) / 100;

        patchGlobalNotifications({
            delivery: {
                sound: {
                    volume: value,
                },
            },
        });

        void playSound({
            type: model.notifications.delivery.sound.type,
            volume: value,
        });
    }

    function onSoundChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        const value = select.value as NotificationSound;

        patchGlobalNotifications({
            delivery: {
                sound: {
                    type: value,
                },
            },
        });

        void playSound({
            type: value,
            volume: model.notifications.delivery.sound.volume,
        });
    }
</script>

<Section title="Alerts" icon={Bell}>
    <ToggleControl
        title="Opportunity alerts"
        description={`Alert when studies appear or change on ${capitalize(model.siteName)}.`}
        value={model.opportunityAlerts.enabled}
        onClick={() =>
            patchSiteNotifications({
                enabled: !model.opportunityAlerts.enabled,
            })}
    >
        {#snippet children()}
            <ToggleControl
                title="Browser notifications"
                description="Push notifications across all sites."
                value={model.notifications.delivery.browser}
                onClick={() =>
                    patchGlobalNotifications({
                        delivery: {
                            browser: !model.notifications.delivery.browser,
                        },
                    })}
            />
            <ToggleControl
                title="Sound alerts"
                description="Play a sound when alerts trigger."
                value={model.notifications.delivery.sound.enabled}
                onClick={() =>
                    patchGlobalNotifications({
                        delivery: {
                            sound: {
                                enabled:
                                    !model.notifications.delivery.sound.enabled,
                            },
                        },
                    })}
            >
                {#snippet children()}
                    <Field label="Alert sound" id="notification-sound">
                        <SelectControl
                            id="notification-sound"
                            bind:value={model.notifications.delivery.sound.type}
                            onchange={onSoundChange}
                        >
                            {#each notificationSounds as sound}
                                <option value={sound}>
                                    {capitalize(sound)}
                                </option>
                            {/each}
                        </SelectControl>
                    </Field>
                    <RangeInput
                        label={`Volume (${Math.round(model.notifications.delivery.sound.volume * 100)}%)`}
                        id="notification-volume"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(
                            model.notifications.delivery.sound.volume * 100,
                        )}
                        onchange={onVolumeChange}
                    />
                {/snippet}
            </ToggleControl>
            <AlertRuleGroupEditor
                title="Notify when"
                group={model.opportunityAlerts.rules.include}
                emptyLabel="All new opportunities"
                suggestions={ruleSuggestions}
                onChange={(group) => updateRuleGroup("include", group)}
            />
            <AlertRuleGroupEditor
                title="Never notify when"
                group={model.opportunityAlerts.rules.exclude}
                emptyLabel="No exclusions"
                suggestions={ruleSuggestions}
                onChange={(group) => updateRuleGroup("exclude", group)}
            />
        {/snippet}
    </ToggleControl>
</Section>
