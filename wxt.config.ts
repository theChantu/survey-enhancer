import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { sites, supportedHosts } from "./src/adapters/siteConfigs";
import { providerHostPermissions } from "./src/providers/providerHosts";

const pageHosts = supportedHosts.map((host) => `https://${host}/*`);

const watchedRequestUrls = supportedHosts.flatMap((host) =>
    sites[host].watchedRequestTargets.map((target) => `https://${target}*`),
);

const hostPermissions = [...new Set([...pageHosts, ...watchedRequestUrls])];

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
