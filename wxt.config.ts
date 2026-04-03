import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { supportedSites } from "./src/adapters/siteConfigs";
import { providerHostPermissions } from "./src/providers/providerHosts";

const hostPermissions = supportedSites.map(
    (site) => `https://${site}/*` as const,
);

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: "src",
    modulesDir: "wxt-modules",
    modules: ["@wxt-dev/module-svelte"],
    vite: () => ({
        plugins: [tailwindcss()],
    }),
    manifest: {
        host_permissions: [...hostPermissions, ...providerHostPermissions],
        permissions: ["storage", "notifications", "tabs", "webRequest", "idle"],

        browser_specific_settings: {
            gecko: {
                id: "@chantu-survey-enhancer",
                ["data_collection_permissions" as any]: {
                    required: ["none"],
                },
            },
        },
    },
});
