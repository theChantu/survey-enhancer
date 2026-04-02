import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => ({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "#imports": path.resolve(__dirname, "src/__mocks__/imports.ts"),
        },
    },
    test: {
        include: ["src/**/*.test.ts"],
        env: loadEnv(mode, process.cwd(), ""),
    },
}));
