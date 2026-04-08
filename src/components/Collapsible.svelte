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

    let open = $state(false);

    $effect(() => {
        open = defaultOpen;
    });

    function toggle() {
        open = !open;
    }
</script>

<div class="rounded-md border border-white/8 bg-white/4 overflow-hidden">
    <button
        class="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left font-[inherit] bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-white/4"
        type="button"
        onclick={toggle}
        aria-expanded={open}
    >
        <div class="min-w-0">
            <div class="text-[0.82rem] font-medium text-gray-200 leading-tight">
                {title}
            </div>
            {#if description}
                <div class="mt-0.5 text-[0.72rem] leading-snug text-gray-500">
                    {description}
                </div>
            {/if}
        </div>
        <div
            class={`mt-0.5 shrink-0 rounded-full border border-white/8 bg-white/4 p-1 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
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
