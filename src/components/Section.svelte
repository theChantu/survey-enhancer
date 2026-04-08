<script lang="ts">
    import type { Component } from "svelte";

    export let title: string;
    export let icon: Component<{ size: number; strokeWidth: number }>;
    export let tone: "default" | "muted" = "default";
</script>

<div class="border-t border-white/6 pt-3">
    <h2 class={`popup-section-heading ${tone === "muted" ? "popup-section-heading-muted" : ""}`}>
        <svelte:component this={icon} size={14} strokeWidth={2.5} />
        {title}
    </h2>
    <slot />
</div>
