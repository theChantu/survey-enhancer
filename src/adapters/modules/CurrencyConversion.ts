import type BaseModule from "./BaseModule";

export default interface CurrencyConversion extends BaseModule {
    getRewardElements(): HTMLElement[];
    getRewardElement(el: HTMLElement): HTMLElement | null;
    getHourlyRateElements(): HTMLElement[];
    getHourlyRateElement(el: HTMLElement): HTMLElement | null;
    setHourlyRate(el: HTMLElement): void;
}
