<script lang="ts">
    import Subsection from "./Subsection.svelte";

    export let label: string;
    export let id: string = "";
</script>

<Subsection className="flex flex-col gap-1.5" borderClass="border-white/4">
    <label for={id} class="text-[0.78rem] font-medium text-gray-500">
        {label}
    </label>
    <slot />
</Subsection>
