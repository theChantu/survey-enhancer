import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { sites, supportedHosts } from "./src/adapters/siteConfigs";
import { providerHostPermissions } from "./src/providers/providerHosts";

const pageHosts = supportedHosts.map((host) => `https://${host}/*`);

const watchedRequestUrls = supportedHosts.flatMap((host) =>
    sites[host].watchedRequestTargets.map((target) => `https://${target}*`),
);

const hostPermissions = [
    ...new Set([
        ...pageHosts,
        ...watchedRequestUrls,
        ...providerHostPermissions,
    ]),
];

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: "src",
    modulesDir: "wxt-modules",
    modules: ["@wxt-dev/module-svelte"],
    vite: () => ({
        plugins: [tailwindcss()],
    }),
    manifest: {
        name: "Survey Enhancer",
        short_name: "Survey Enhancer",
        description:
            "Get alerts, highlight better-paying studies, convert rewards, and track activity across supported survey sites.",
        host_permissions: hostPermissions,
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
