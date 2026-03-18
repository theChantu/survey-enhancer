<script lang="ts">
    import { X } from "@lucide/svelte";
    import { cleanResearcherName } from "@/lib/utils";

    export let title: string;
    export let names: string[];
    export let suggestions: string[];
    export let onAdd: (name: string) => void;
    export let onRemove: (name: string) => void;

    let input = "";

    $: filtered =
        input.length > 0
            ? suggestions.filter(
                  (s) =>
                      s.includes(cleanResearcherName(input)) &&
                      !names.includes(s),
              )
            : [];

    function addName(name: string) {
        const cleaned = cleanResearcherName(name);
        if (cleaned && !names.includes(cleaned)) {
            onAdd(cleaned);
        }
        input = "";
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            if (filtered.length > 0) {
                addName(filtered[0]);
            } else {
                addName(input);
            }
        }
    }
</script>

<div class="researcher-list">
    <span class="list-label">{title}</span>
    {#if names.length > 0}
        <div class="tags">
            {#each names as name}
                <span class="tag">
                    {name}
                    <button
                        class="tag-remove"
                        on:click={() => onRemove(name)}
                        aria-label="Remove {name}"
                    >
                        <X size={10} />
                    </button>
                </span>
            {/each}
        </div>
    {/if}
    <div class="input-wrap">
        <input
            type="text"
            placeholder="Add researcher..."
            bind:value={input}
            on:keydown={handleKeydown}
        />
        {#if filtered.length > 0}
            <ul class="suggestions">
                {#each filtered.slice(0, 5) as suggestion}
                    <li>
                        <button
                            on:mousedown|preventDefault={() =>
                                addName(suggestion)}
                        >
                            {suggestion}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

<style>
    .researcher-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .list-label {
        font-size: 0.78rem;
        font-weight: 500;
        color: #6b7280;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: #d1d5db;
        font-size: 0.74rem;
    }

    .tag-remove {
        display: inline-flex;
        align-items: center;
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .tag-remove:hover {
        color: #ef4444;
    }

    .input-wrap {
        position: relative;
    }

    input {
        width: 100%;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #d1d5db;
        font-size: 0.78rem;
        font-family: inherit;
        outline: none;
        box-sizing: border-box;
    }

    input::placeholder {
        color: #4b5563;
    }

    input:focus {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .suggestions {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin: 4px 0 0;
        padding: 4px 0;
        list-style: none;
        background: #1a1d21;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        z-index: 10;
        max-height: 140px;
        overflow-y: auto;
    }

    .suggestions li button {
        display: block;
        width: 100%;
        padding: 6px 10px;
        background: none;
        border: none;
        color: #d1d5db;
        font-size: 0.78rem;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
    }

    .suggestions li button:hover {
        background: rgba(255, 255, 255, 0.06);
    }
</style>
