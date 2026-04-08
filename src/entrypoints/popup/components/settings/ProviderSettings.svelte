<script lang="ts">
    import { Send } from "@lucide/svelte";
    import ToggleControl from "@/components/ToggleControl.svelte";
    import Section from "@/components/Section.svelte";
    import Subsection from "@/components/Subsection.svelte";
    import { parsePositiveInt } from "@/lib/parsePositiveInt";
    import Field from "@/components/Field.svelte";

    import type { ProviderSettingsModel } from "../../types";

    let { model }: { model: ProviderSettingsModel } = $props();

    const providerSetupUrl =
        "https://github.com/theChantu/survey-enhancer#provider-setup";
</script>

<Section title="Delivery" icon={Send}>
    <div class="mb-2 text-[0.74rem] text-gray-400">
        Need help getting Telegram set up?
        <a
            href={providerSetupUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="popup-inline-link ml-1"
            >Open the setup guide</a
        >
    </div>
    <Field label="Idle threshold (minutes)" id="idle-threshold">
        <input
            id="idle-threshold"
            type="number"
            min="1"
            step="1"
            class="popup-control box-border"
            value={Math.max(1, Math.round(model.idleThreshold / 60))}
            onchange={(e) => {
                const minutes = parsePositiveInt(e.currentTarget.value);
                if (minutes === null) return;
                model.onIdleThresholdChange(minutes);
            }}
        />
    </Field>
    <Subsection withDivider={false}>
        <ToggleControl
            title="Telegram alerts"
            description="Send alerts through Telegram when you are idle."
            value={model.providers.telegram?.enabled ?? false}
            onClick={model.onTelegramToggle}
        >
            {#snippet children()}
                <Field label="Bot token" id="telegram-bot-token">
                    <input
                        id="telegram-bot-token"
                        type="password"
                        class="popup-control box-border"
                        value={model.providers.telegram?.botToken ?? ""}
                        onchange={(e) => {
                            model.onBotTokenChange(
                                (e.target as HTMLInputElement).value,
                            );
                        }}
                    />
                </Field>
            {/snippet}
        </ToggleControl>
    </Subsection>
</Section>
