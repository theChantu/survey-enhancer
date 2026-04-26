# Privacy Policy

**Last updated:** April 25, 2026

Study Signal is an open source browser extension that monitors research study platforms. This policy explains what data the extension accesses and how it is handled.

## Data that stays on your device

All extension data is stored locally in your browser's extension storage. This includes:

- Your settings and preferences
- Cached study metadata (used for deduplication and notifications)
- Analytics (study completion counts)

This data is never transmitted to any server and never leaves your device.

## Network requests

The extension makes the following network requests:

- **Study platform APIs** (Prolific, CloudResearch) - The extension reads network responses on supported sites to detect study completions. It does not modify, intercept, or forward this data.
- **Telegram API** - If you enable Telegram notifications, the extension sends alert messages to the Telegram Bot API using a bot token you provide. No data is sent unless you explicitly configure this feature.
- **Currency conversion** - If you enable currency conversion, the extension fetches exchange rates from a third-party API. No personal data is included in these requests.

## Permissions

| Permission         | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `storage`          | Save your settings and cached data locally                                 |
| `tabs`             | Detect which supported sites are open and communicate with content scripts |
| `notifications`    | Show browser notifications for new opportunities                           |
| `webRequest`       | Monitor study platform API responses to detect study completions           |
| `idle`             | Determine if you are idle/locked to route alerts to Telegram               |
| `offscreen`        | Play notification sounds in Chromium-based browsers                        |
| `Host permissions` | Scoped to supported study sites, their internal APIs, and the Telegram API |

## Third-party services

The extension does not use analytics, telemetry, or tracking of any kind. No data is collected by the developer.

The only third-party services contacted are:

- **Telegram Bot API** - Only when you enable and configure Telegram notifications
- **Exchange rate API** - Only when you enable currency conversion

## Your control

You can disable any feature at any time through the extension's settings. Uninstalling the extension removes all locally stored data.

## Contact

If you have questions about this policy, please open an issue at [github.com/theChantu/study-signal](https://github.com/theChantu/study-signal/issues).
