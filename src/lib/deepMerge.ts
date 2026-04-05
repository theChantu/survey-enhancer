export default function deepMerge(target: any, source: any): any {
    if (source === undefined) return target;
    if (Array.isArray(source) || Array.isArray(target)) return source;

    if (
        typeof target === "object" &&
        target !== null &&
        typeof source === "object" &&
        source !== null
    ) {
        const merged = { ...target };
        for (const key of Object.keys(source)) {
            merged[key] = deepMerge(target[key], source[key]);
        }
        return merged;
    }

    return source;
}
