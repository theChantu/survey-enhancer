# Survey Enhancer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/github/package-json/v/theChantu/survey-enhancer?color=gre)

A browser extension that enhances the survey experience on [Prolific](https://app.prolific.com/) and [CloudResearch](https://connect.cloudresearch.com/).

## Features

- **Highlight Rates:** Applies color scaling to hourly rates to highlight high vs low paying studies.
- **Currency Conversion:** Converts rewards into USD or GBP.
- **Direct Survey Links:** Adds direct links to each survey.
- **Notifications:** Desktop alerts when new studies appear, with researcher include/exclude filters.
- **Auto Reload:** Automatically refreshes the page at random intervals to check for new studies.
- **Per-Site Settings:** Configure each supported site independently from the popup.

## Supported Sites

- [Prolific](https://app.prolific.com/studies)
- [CloudResearch](https://connect.cloudresearch.com/participant/dashboard)

## Installation

### Chrome / Chromium

1. Download the latest release `.zip` for Chrome.
2. Unzip the file.
3. Go to `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

### Firefox

1. Download the latest release `.zip` for Firefox.
2. Unzip the file.
3. Go to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on** and select any file in the unzipped folder.

## Usage

1. Navigate to a supported site.
2. Click the Survey Enhancer icon in the toolbar to open the popup.
3. Toggle features and adjust settings per site.
4. The popup auto-detects which site you're on.

## Provider Setup

The extension supports Telegram notifications when your device is idle/locked and the provider is enabled.

### Telegram setup

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Create a bot using `/newbot` and copy the bot token.
3. Send at least one message to your bot from your Telegram account.
4. Paste the token into **Providers -> Telegram -> Bot token**.

### Troubleshooting

- Ensure the extension has been reloaded after permission changes.
- Confirm your token is correct.
- For Telegram, make sure you sent a message to the bot before testing.

Provider credentials are stored in extension storage on your local browser profile.

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.2+

### Setup

```bash
git clone https://github.com/theChantu/survey-enhancer.git
cd survey-enhancer
bun install
```

### Commands

```bash
bun run dev              # Dev mode (Chrome)
bun run dev:firefox      # Dev mode (Firefox)
bun run build            # Production build (Chrome)
bun run build:firefox    # Production build (Firefox)
bun run zip              # Package for distribution (Chrome)
bun run zip:firefox      # Package for distribution (Firefox)
```

## License

Distributed under the MIT License. See `LICENSE` for more information.
