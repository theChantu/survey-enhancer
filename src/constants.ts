import type { Currency } from "@/store/types";

export const NOTIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const NAME_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const CONVERSION_RATES_FETCH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MIN_AMOUNT_PER_HOUR = 7; // Minimum amount before red highlight
export const MAX_AMOUNT_PER_HOUR = 15; // Maximum amount before green highlight
export const HIGHLIGHT_BASE_CURRENCY: Currency = "USD";
