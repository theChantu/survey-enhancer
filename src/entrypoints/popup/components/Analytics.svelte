<script lang="ts">
    import { ChartColumn } from "@lucide/svelte";
    import Collapsible from "@/components/Collapsible.svelte";
    import Section from "@/components/Section.svelte";

    import type { AnalyticsModel } from "../types";

    let { model }: { model: AnalyticsModel } = $props();

    const todayCount = $derived(model.dailySurveyCompletions.count);
    const bestCount = $derived(model.bestDailySurveyCompletions);
    const previousCount = $derived(model.previousDailySurveyCompletions);

    function pluralize(count: number, noun: string) {
        return `${count} ${noun}${count === 1 ? "" : "s"}`;
    }

    const analyticsSummary = $derived.by(() => {
        if (todayCount === 0) {
            return "Complete a survey to start today's count.";
        }

        if (bestCount > 0 && todayCount === bestCount) {
            if (previousCount > 0 && todayCount > previousCount) {
                return `Matching your best day and ${pluralize(todayCount - previousCount, "completion")} ahead of your last active day.`;
            }

            return "Matching your best day.";
        }

        if (previousCount > 0 && todayCount > previousCount) {
            return `${pluralize(todayCount - previousCount, "completion")} ahead of your last active day.`;
        }

        if (bestCount > todayCount) {
            return `${pluralize(bestCount - todayCount, "completion")} away from your best day.`;
        }

        return "Analytics update automatically as completions are tracked.";
    });
</script>

<Section title="Analytics" icon={ChartColumn}>
    <Collapsible
        title="Stats"
        description={analyticsSummary}
        defaultOpen={todayCount > 0 && todayCount === bestCount}
    >
        {#snippet children()}
            <div class="divide-y divide-white/6">
                <div class="flex items-center justify-between py-2">
                    <span class="text-[0.78rem] text-gray-400"
                        >Completed today</span
                    >
                    <span class="text-[1.05rem] font-semibold text-gray-100">
                        {todayCount}
                    </span>
                </div>

                <div class="flex items-center justify-between py-2">
                    <span class="text-[0.78rem] text-gray-400">Best day</span>
                    <span class="text-[1.05rem] font-semibold text-gray-200">
                        {bestCount}
                    </span>
                </div>

                <div class="flex items-center justify-between py-2">
                    <span class="text-[0.78rem] text-gray-400"
                        >Last active day</span
                    >
                    <span class="text-[1.05rem] font-semibold text-gray-300">
                        {previousCount}
                    </span>
                </div>

                <div class="flex items-center justify-between py-2">
                    <span class="text-[0.78rem] text-gray-400"
                        >Total completed</span
                    >
                    <span class="text-[1.05rem] font-semibold text-gray-300">
                        {model.totalSurveyCompletions}
                    </span>
                </div>
            </div>
        {/snippet}
    </Collapsible>
</Section>
