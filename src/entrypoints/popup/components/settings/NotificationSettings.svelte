<script lang="ts">
    import { Bell, ChevronDown } from "@lucide/svelte";
    import Field from "@/components/Field.svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { capitalize, cleanResearcherName } from "@/lib/utils";
    import TagInput from "@/components/TagInput.svelte";
    import type {
        DeepPartial,
        NewSurveyNotificationsSettings,
        NotificationSound,
        SiteSettings,
    } from "@/store/types";

    import type { NotificationSettingsModel } from "../../types";

    let { model }: { model: NotificationSettingsModel } = $props();

    const notificationSounds = [
        "alert",
        "bloop",
        "chime",
    ] as const satisfies NotificationSound[];

    type ResearcherKey = Exclude<
        keyof NewSurveyNotificationsSettings,
        "surveys" | "cachedResearchers" | "delivery"
    >;

    function patchNotifications(
        data: DeepPartial<SiteSettings["newSurveyNotifications"]>,
    ) {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                newSurveyNotifications: data,
            },
        });
    }

    function handleAddResearcher(key: ResearcherKey, name: string) {
        if (model.newSurveyNotifications[key].includes(name)) return;

        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                newSurveyNotifications: {
                    [key]: [...model.newSurveyNotifications[key], name],
                },
            },
        });
    }

    function handleRemoveResearcher(key: ResearcherKey, name: string) {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                newSurveyNotifications: {
                    [key]: model.newSurveyNotifications[key].filter(
                        (candidate) => candidate !== name,
                    ),
                },
            },
        });
    }
</script>

<Section title="Alerts" icon={Bell}>
    <ToggleControl
        title="New survey alerts"
        description="Get notified when a new survey shows up."
        value={model.newSurveyNotifications.enabled}
        onClick={() =>
            patchNotifications({
                enabled: !model.newSurveyNotifications.enabled,
            })}
    >
        {#snippet children()}
            <ToggleControl
                title="Browser notifications"
                description="Show a browser notification when a matching survey appears."
                value={model.newSurveyNotifications.delivery.browser}
                onClick={() =>
                    patchNotifications({
                        delivery: {
                            browser:
                                !model.newSurveyNotifications.delivery.browser,
                        },
                    })}
            />
            <ToggleControl
                title="Sound alerts"
                description="Play a sound when a matching survey appears."
                value={model.newSurveyNotifications.delivery.sound.enabled}
                onClick={() =>
                    patchNotifications({
                        delivery: {
                            sound: {
                                enabled:
                                    !model.newSurveyNotifications.delivery.sound
                                        .enabled,
                            },
                        },
                    })}
            >
                {#snippet children()}
                    <Field label="Alert sound" id="notification-sound">
                        <div class="relative text-gray-500">
                            <select
                                id="notification-sound"
                                class="popup-select-control [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                                bind:value={
                                    model.newSurveyNotifications.delivery.sound
                                        .type
                                }
                                onchange={(e) =>
                                    patchNotifications({
                                        delivery: {
                                            sound: {
                                                type: (
                                                    e.target as HTMLSelectElement
                                                ).value as NotificationSound,
                                            },
                                        },
                                    })}
                            >
                                {#each notificationSounds as sound}
                                    <option value={sound}>
                                        {capitalize(sound)}
                                    </option>
                                {/each}
                            </select>
                            <div class="popup-control-chevron">
                                <ChevronDown size={12} strokeWidth={2.4} />
                            </div>
                        </div>
                    </Field>
                    <Field
                        label={`Volume (${Math.round(model.newSurveyNotifications.delivery.sound.volume * 100)}%)`}
                        id="notification-volume"
                    >
                        <input
                            id="notification-volume"
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            class="w-full accent-indigo-400"
                            value={Math.round(
                                model.newSurveyNotifications.delivery.sound
                                    .volume * 100,
                            )}
                            onchange={(e) =>
                                patchNotifications({
                                    delivery: {
                                        sound: {
                                            volume:
                                                Number(
                                                    (
                                                        e.target as HTMLInputElement
                                                    ).value,
                                                ) / 100,
                                        },
                                    },
                                })}
                        />
                    </Field>
                {/snippet}
            </ToggleControl>
            <TagInput
                title="Included researchers"
                values={model.newSurveyNotifications.includedResearchers}
                suggestions={Object.keys(
                    model.newSurveyNotifications.cachedResearchers,
                )}
                placeholder="Add researcher..."
                clean={cleanResearcherName}
                onAdd={(name) =>
                    handleAddResearcher("includedResearchers", name)}
                onRemove={(name) =>
                    handleRemoveResearcher("includedResearchers", name)}
            />
            <TagInput
                title="Excluded researchers"
                values={model.newSurveyNotifications.excludedResearchers}
                suggestions={Object.keys(
                    model.newSurveyNotifications.cachedResearchers,
                )}
                placeholder="Add researcher..."
                clean={cleanResearcherName}
                onAdd={(name) =>
                    handleAddResearcher("excludedResearchers", name)}
                onRemove={(name) =>
                    handleRemoveResearcher("excludedResearchers", name)}
            />
        {/snippet}
    </ToggleControl>
</Section>
