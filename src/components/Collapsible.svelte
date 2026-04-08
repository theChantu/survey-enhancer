<script lang="ts">
    import { ChevronDown } from "@lucide/svelte";
    import { slide } from "svelte/transition";

    import type { Snippet } from "svelte";

    type CollapsibleProps = {
        title: string;
        description?: string;
        defaultOpen?: boolean;
        children: Snippet;
    };

    let {
        title,
        description,
        defaultOpen = false,
        children,
    }: CollapsibleProps = $props();

    let loaded = false;
    let open = $state(false);

    $effect(() => {
        if (!loaded) {
            open = defaultOpen;
            loaded = true;
        }
    });

    function toggle() {
        open = !open;
    }
</script>

<div class="popup-surface overflow-hidden">
    <button
        class="flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent px-3 py-2.5 text-left font-[inherit] transition-colors duration-150 hover:bg-white/4"
        type="button"
        onclick={toggle}
        aria-expanded={open}
    >
        <div class="min-w-0">
            <div class="text-[0.82rem] font-medium leading-tight text-gray-100">
                {title}
            </div>
            {#if description}
                <div class="mt-0.5 text-[0.72rem] leading-snug text-gray-400">
                    {description}
                </div>
            {/if}
        </div>
        <div class={`popup-chip-chevron mt-0.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <ChevronDown size={12} strokeWidth={2.4} />
        </div>
    </button>

    {#if open && children}
        <div
            transition:slide={{ duration: 160 }}
            class="border-t border-white/6 px-3 py-2.5"
        >
            {@render children()}
        </div>
    {/if}
</div>
