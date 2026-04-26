# Study Signal

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/github/package-json/v/theChantu/study-signal?color=gre)

A browser extension that monitors research study platforms and alerts you when new studies are available.

<table>
  <tr>
    <td><img src=".github/screenshots/opportunities-tab.png" alt="Opportunities tab" width="360" /></td>
    <td><img src=".github/screenshots/settings-tab.png" alt="Settings tab" width="360" /></td>
  </tr>
</table>

<img src=".github/screenshots/rate-highlighting.png" alt="Rate highlighting on Prolific" width="720" />

## Features

- **Opportunities Inbox:** View opportunities from supported sites in one popup tab, with various sorting options.
- **Highlight Rates:** Applies color scaling to hourly rates to highlight higher and lower paying studies.
- **Currency Conversion:** Converts rewards into your selected target currency.
- **Notifications:** Opportunity alerts with configurable rules for title, researcher, reward, hourly rate, slots, and average completion time.
- **Auto Reload:** Automatically refreshes the page at random intervals to check for new opportunities.
- **Analytics:** Tracks completed opportunities and daily progress per supported site.

## Supported Sites

- [Prolific](https://www.prolific.com)
- [CloudResearch](https://www.cloudresearch.com)

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
2. Click the Study Signal icon in the toolbar to open the popup.
3. Use the `Opportunities` tab to view live opportunity snapshots combined from supported open tabs.
4. Use the `Settings` tab to configure the currently selected site.
5. Keep a supported study listings tab open if you want live opportunities and alerts to keep updating.

## Provider Setup

The extension supports browser notifications, optional sounds, and Telegram provider delivery.
Telegram can send every matching alert, or only send when your browser reports that you are idle/locked.

### Telegram setup

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Create a bot using `/newbot` and copy the bot token.
3. Send at least one message to your bot from your Telegram account.
4. Open **Settings -> Delivery**, enable **Telegram alerts**, and paste the token into **Bot token**.
5. In **Settings -> Developer**, enable **Developer mode**, then click **Provider** under **Test notifications**. This sends a test message and saves the Telegram chat ID for future alerts.
6. Turn on **Only when idle** if you want Telegram to act as an away-from-computer fallback instead of sending every matching alert.

### Troubleshooting

- Ensure the extension has been reloaded after permission changes.
- Confirm your token is correct.
- For Telegram, make sure you sent a message to the bot before testing the provider.
- If the first Telegram test fails, send another message to the bot and click **Provider** again.

Provider credentials are stored in extension storage on your local browser profile.

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.2+

### Setup

```bash
git clone https://github.com/theChantu/study-signal.git
cd study-signal
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

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Open a pull request against `main`

## Privacy

See [PRIVACY.md](PRIVACY.md) for details on how the extension handles your data.

## License

Distributed under the MIT License. See `LICENSE` for more information.
