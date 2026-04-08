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

<Section title="Providers" icon={Send}>
    <div class="mb-2 text-[0.74rem] text-gray-500">
        Need help with bot setup?
        <a
            href={providerSetupUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 text-indigo-300 hover:text-indigo-200"
            >View setup guide</a
        >
    </div>
    <Field label="Idle threshold (minutes)" id="idle-threshold">
        <input
            id="idle-threshold"
            type="number"
            min="1"
            step="1"
            class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
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
            title="Telegram"
            description="Send notifications via Telegram bot when idle."
            value={model.providers.telegram?.enabled ?? false}
            onClick={model.onTelegramToggle}
        >
            {#snippet children()}
                <Field label="Bot token" id="telegram-bot-token">
                    <input
                        id="telegram-bot-token"
                        type="password"
                        class="w-full py-2 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.82rem] font-[inherit] outline-none box-border focus:border-white/20"
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
