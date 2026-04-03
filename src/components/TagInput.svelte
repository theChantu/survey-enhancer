<script lang="ts">
    import { X } from "@lucide/svelte";
    import Subsection from "./Subsection.svelte";

    export let title: string;
    export let values: string[];
    export let suggestions: string[] = [];
    export let placeholder: string = "Add...";
    export let onAdd: (value: string) => void;
    export let onRemove: (value: string) => void;
    export let clean: (value: string) => string = (v) => v.trim();

    let input = "";

    $: filtered =
        input.length > 0
            ? suggestions.filter(
                  (s) => s.includes(clean(input)) && !values.includes(s),
              )
            : [];

    function add(value: string) {
        const cleaned = clean(value);
        if (cleaned && !values.includes(cleaned)) {
            onAdd(cleaned);
        }
        input = "";
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            if (filtered.length > 0) {
                add(filtered[0]);
            } else {
                add(input);
            }
        }
    }
</script>

<Subsection className="flex flex-col gap-1.5" borderClass="border-white/4">
    <span class="text-[0.78rem] font-medium text-gray-500">{title}</span>
    {#if values.length > 0}
        <div class="flex flex-wrap gap-1">
            {#each values as value}
                <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/8 text-gray-300 text-[0.74rem]"
                >
                    {value}
                    <button
                        class="inline-flex items-center bg-transparent border-none text-gray-500 cursor-pointer p-0 leading-none hover:text-red-500"
                        on:click={() => onRemove(value)}
                        aria-label="Remove {value}"
                    >
                        <X size={10} />
                    </button>
                </span>
            {/each}
        </div>
    {/if}
    <div class="relative">
        <input
            type="text"
            {placeholder}
            class="w-full py-1.5 px-2.5 rounded-md border border-white/8 bg-white/4 text-gray-300 text-[0.78rem] font-[inherit] outline-none box-border placeholder:text-gray-600 focus:border-white/20"
            bind:value={input}
            on:keydown={handleKeydown}
        />
        {#if filtered.length > 0}
            <ul
                class="absolute top-full left-0 right-0 mt-1 py-1 list-none bg-[#1a1d21] border border-white/10 rounded-md z-10 max-h-35 overflow-y-auto"
            >
                {#each filtered.slice(0, 5) as suggestion}
                    <li>
                        <button
                            class="block w-full py-1.5 px-2.5 bg-transparent border-none text-gray-300 text-[0.78rem] font-[inherit] text-left cursor-pointer hover:bg-white/6"
                            on:mousedown|preventDefault={() => add(suggestion)}
                        >
                            {suggestion}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</Subsection>
