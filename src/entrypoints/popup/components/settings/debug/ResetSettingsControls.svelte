<script lang="ts">
    import Subsection from "@/components/Subsection.svelte";
    import { defaultGlobalSettings } from "@/store/defaultGlobalSettings";
    import { defaultSiteSettings } from "@/store/defaultSiteSettings";
    import { set } from "@/entrypoints/popup/popupMutations";
    import { showActionToast } from "@/entrypoints/popup/toastStore";

    import type { SettingComponentProps } from "@/entrypoints/popup/types";
    import type { GlobalSettings, SiteSettings } from "@/store/types";

    let { activeSite, settingsState }: SettingComponentProps = $props();

    type GlobalResetKey = Exclude<keyof GlobalSettings, "enableDebug">;
    type SiteResetKey = keyof SiteSettings;

    const resettableGlobalKeys = Object.keys(defaultGlobalSettings).filter(
        (k) => k in defaultGlobalSettings && k !== "enableDebug",
    ) as GlobalResetKey[];
    const resettableSiteKeys = Object.keys(
        defaultSiteSettings,
    ) as SiteResetKey[];

    export function formatKey(key: string) {
        return key.replace(/([A-Z])/g, " $1").toLowerCase();
    }

    const settingsSnapshot = $derived($state.snapshot(settingsState));

    function handleResetGlobalKey(key: GlobalResetKey) {
        const previous = structuredClone(settingsSnapshot.globals?.[key]);
        const next = structuredClone(defaultGlobalSettings[key]);

        void set({
            namespace: "globals",
            data: { [key]: next },
        });

        showActionToast({
            message: `Reset ${formatKey(key)}.`,
            actionLabel: "Undo",
            onAction: () =>
                previous !== undefined
                    ? set({
                          namespace: "globals",
                          data: { [key]: previous },
                      })
                    : Promise.resolve(),
        });
    }

    function handleResetSiteKey(key: SiteResetKey) {
        if (!settingsState.sites[activeSite.url]?.[key]) return;

        const previous = structuredClone(
            settingsSnapshot.sites[activeSite.url]?.[key],
        );
        const next = structuredClone(defaultSiteSettings[key]);

        void set({
            namespace: "sites",
            entry: activeSite.name,
            data: { [key]: next },
        });

        showActionToast({
            message: `Reset ${formatKey(key)}.`,
            actionLabel: "Undo",
            onAction: () =>
                set({
                    namespace: "sites",
                    entry: activeSite.name,
                    data: { [key]: previous },
                }),
        });
    }
</script>

<Subsection className="flex flex-col gap-2" borderClass="border-white/4">
    <span class="text-[0.78rem] font-medium text-gray-500"
        >Reset to default</span
    >
    <div class="flex flex-wrap gap-1">
        {#each resettableGlobalKeys as key}
            <button
                class="py-1 px-2 rounded border border-white/8 bg-white/4 text-gray-300 text-[0.72rem] font-[inherit] cursor-pointer hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                onclick={() => handleResetGlobalKey(key)}
            >
                {formatKey(key)}
            </button>
        {/each}
        {#each resettableSiteKeys as key}
            <button
                class="py-1 px-2 rounded border border-white/8 bg-white/4 text-gray-300 text-[0.72rem] font-[inherit] cursor-pointer hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                onclick={() => handleResetSiteKey(key)}
            >
                {formatKey(key)}
            </button>
        {/each}
    </div>
</Subsection>
