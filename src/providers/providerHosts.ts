export const TELEGRAM_ORIGIN = "https://api.telegram.org";

export const TELEGRAM_API_BASE_URL = TELEGRAM_ORIGIN;

const providerHosts = [TELEGRAM_ORIGIN] as const;

export const providerHostPermissions = providerHosts.map(
    (host) => `${host}/*` as const,
);
