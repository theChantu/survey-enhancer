import { latestChangelogEntry } from "../src/lib/changelog";

if (!latestChangelogEntry) {
    console.error("No changelog entry found.");
    process.exit(1);
}

const { version, title, items } = latestChangelogEntry;

const lines = [
    `v${version} - ${title}`,
    "",
    ...items.map((item) => `• ${item}`),
];

const output = lines.join("\n");

console.log(output);

const proc = Bun.spawn(["clip"], { stdin: "pipe" });
proc.stdin.write(output);
proc.stdin.end();
await proc.exited;
console.log("\nCopied to clipboard.");
