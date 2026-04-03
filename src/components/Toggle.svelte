<script lang="ts">
    export let title: string;
    export let description: string;
    export let value: boolean;
    export let onClick: () => void;
</script>

<label class="flex items-center justify-between gap-4 py-2 cursor-pointer border-t border-white/4">
    <div class="min-w-0">
        <div class="text-[0.84rem] font-medium text-gray-300 leading-tight">{title}</div>
        <div class="mt-0.5 text-[0.72rem] leading-snug text-gray-500">{description}</div>
    </div>
    <button
        class="relative w-9 h-5 rounded-full border-none shrink-0 transition-colors duration-150 p-0 cursor-pointer {value ? 'bg-indigo-500' : 'bg-white/10'}"
        on:click={onClick}
        role="switch"
        aria-checked={value}
        aria-label={title}
    >
        <span
            class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 {value ? 'translate-x-4' : ''}"
        ></span>
    </button>
</label>
