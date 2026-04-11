<script lang="ts">
    import { Bell, ChevronDown } from "@lucide/svelte";
    import Field from "@/components/Field.svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import { capitalize, cleanResearcherName } from "@/lib/utils";
    import TagInput from "@/components/TagInput.svelte";
    import type {
        DeepPartial,
        GlobalSettings,
        NotificationSound,
        SiteSettings,
    } from "@/store/types";
    import { playSound } from "@/lib/playSound";

    import type { NotificationSettingsModel } from "../../types";

    let { model }: { model: NotificationSettingsModel } = $props();

    const notificationSounds = [
        "alert",
        "bloop",
        "chime",
    ] as const satisfies NotificationSound[];

    type ResearcherKey = Exclude<
        keyof SiteSettings["studyAlerts"],
        "cache" | "enabled"
    >;

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
        data: DeepPartial<SiteSettings["studyAlerts"]>,
    ) {
        void model.queueMutation("store-patch", {
            namespace: "sites",
            entry: model.siteName,
            data: {
                studyAlerts: data,
            },
        });
    }

    function updateResearcherList(
        key: ResearcherKey,
        name: string,
        method: "add" | "remove",
    ) {
        if (method === "add") {
            if (model.studyAlerts[key].includes(name)) return;

            patchSiteNotifications({
                [key]: [...model.studyAlerts[key], name],
            });
        } else {
            patchSiteNotifications({
                [key]: model.studyAlerts[key].filter(
                    (candidate) => candidate !== name,
                ),
            });
        }
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
        title="New study alerts"
        description={`Get notified when a new study shows up. Applies to  ${capitalize(model.siteName)} only.`}
        value={model.studyAlerts.enabled}
        onClick={() =>
            patchSiteNotifications({
                enabled: !model.studyAlerts.enabled,
            })}
    >
        {#snippet children()}
            <ToggleControl
                title="Browser notifications"
                description="Show a browser notification for alerts across all supported sites."
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
                description="Play a sound for alerts across all supported sites."
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
                        <div class="relative text-gray-500">
                            <select
                                id="notification-sound"
                                class="popup-select-control [&_option]:bg-[#1a1d21] [&_option]:text-gray-300"
                                bind:value={
                                    model.notifications.delivery.sound.type
                                }
                                onchange={onSoundChange}
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
                        label={`Volume (${Math.round(model.notifications.delivery.sound.volume * 100)}%)`}
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
                                model.notifications.delivery.sound.volume * 100,
                            )}
                            onchange={onVolumeChange}
                        />
                    </Field>
                {/snippet}
            </ToggleControl>
            <TagInput
                title="Included researchers"
                values={model.studyAlerts.included}
                suggestions={Object.keys(model.studyAlerts.cache.researchers)}
                placeholder="Add researcher"
                clean={cleanResearcherName}
                onAdd={(name) => updateResearcherList("included", name, "add")}
                onRemove={(name) =>
                    updateResearcherList("included", name, "remove")}
            />
            <TagInput
                title="Excluded researchers"
                values={model.studyAlerts.excluded}
                suggestions={Object.keys(model.studyAlerts.cache.researchers)}
                placeholder="Add researcher"
                clean={cleanResearcherName}
                onAdd={(name) => updateResearcherList("excluded", name, "add")}
                onRemove={(name) =>
                    updateResearcherList("excluded", name, "remove")}
            />
        {/snippet}
    </ToggleControl>
</Section>
