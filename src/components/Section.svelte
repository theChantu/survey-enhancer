<script lang="ts">
    import type { Component } from "svelte";

    export let title: string;
    export let icon: Component<{ size: number; strokeWidth: number }>;
</script>

<div class="border-t border-white/6 pt-3">
    <h2
        class="flex items-center gap-1.5 mb-2 text-[0.7rem] font-semibold text-gray-500 uppercase tracking-wide"
    >
        <svelte:component this={icon} size={14} strokeWidth={2.5} />
        {title}
    </h2>
    <slot />
</div>
