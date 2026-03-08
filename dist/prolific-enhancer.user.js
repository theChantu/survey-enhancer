// ==UserScript==
// @name         Prolific Enhancer
// @namespace    Violentmonkey Scripts
// @version      1.5
// @description  A lightweight userscript that makes finding worthwhile Prolific studies faster and less annoying.
// @author       Chantu
// @license      MIT
// @include        *://app.prolific.com/*
// @include        *://connect.cloudresearch.com/*
// @grant        GM.notification
// @grant        GM.getValue
// @grant        GM.getValues
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM.openInTab
// @grant        GM.addStyle
// @grant        GM.getResourceUrl
// @grant        GM.registerMenuCommand
// @grant        GM.unregisterMenuCommand
// @resource     prolific https://app.prolific.com/apple-touch-icon.png
// @resource     cloudresearch https://connect.cloudresearch.com/participant/favicon.ico
// @downloadURL  https://github.com/theChantu/prolific-enhancer/raw/main/dist/prolific-enhancer.user.js
// ==/UserScript==

"use strict";
(() => {
  // src/store/defaults.ts
  var defaultVMSettings = Object.freeze({
    conversionRates: {
      timestamp: 0,
      USD: { rates: { GBP: 0.74, USD: 1 } },
      GBP: { rates: { USD: 1.35, GBP: 1 } }
    },
    selectedCurrency: "USD",
    enableCurrencyConversion: true,
    enableDebug: false,
    enableHighlightRates: true,
    enableSurveyLinks: true,
    enableNewSurveyNotifications: true,
    surveys: {},
    ui: { initialized: false, hidden: true, position: { left: 0, top: 0 } }
  });

  // src/store/store.ts
  function deepMerge(target, source) {
    if (source === void 0) return target;
    if (typeof target === "object" && target !== null && typeof source === "object" && source !== null) {
      const merged = { ...target };
      for (const key of Object.keys(source)) {
        merged[key] = deepMerge(target[key], source[key]);
      }
      return merged;
    }
    return source;
  }
  function createStore() {
    const listeners = /* @__PURE__ */ new Set();
    const get = async (keys) => {
      const values = await GM.getValues([...keys]);
      return Object.fromEntries(
        keys.map((k) => {
          return [k, deepMerge(defaultVMSettings[k], values[k])];
        })
      );
    };
    const notify = (values) => {
      for (const listener of listeners) listener(values);
    };
    const set = async (values) => {
      const newValues = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== void 0)
      );
      await GM.setValues(newValues);
      notify(newValues);
    };
    const update = async (values) => {
      const keys = Object.keys(values);
      const prevValues = await get(keys);
      const newValues = Object.fromEntries(
        keys.map((k) => {
          const prev = prevValues[k];
          const next = values[k];
          if (typeof prev === "object" && prev !== null && typeof next === "object" && next !== null && !Array.isArray(prev) && !Array.isArray(next)) {
            return [k, { ...prev, ...next }];
          }
          return [k, next === void 0 ? prev : next];
        })
      );
      await GM.setValues(newValues);
      notify(newValues);
    };
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return { get, set, update, subscribe };
  }
  var store = createStore();
  var store_default = store;

  // src/adapters/Adapter.ts
  var BaseAdapter = class {
    settings;
    constructor(defaults, overrides = {}) {
      this.settings = { ...defaults, ...overrides };
    }
    // abstract setCurrencySymbol(): void;
    // abstract setSourceCurrencySymbol(): void;
    // abstract prepareNextScan?(): Promise<void>;
    // TODO: Used to add to survey URL
    // For instance, cloud research, show 100 surveys, "https://connect.cloudresearch.com/participant/dashboard" + "?page=1&size=100"
    // abstract overrideUrl(url: string): string;
  };

  // src/utils.ts
  var debugEnabled = false;
  async function initDebug() {
    const { enableDebug } = await store_default.get(["enableDebug"]);
    debugEnabled = enableDebug;
  }
  var log = (...args) => {
    if (debugEnabled) console.log("[Prolific Enhancer]", ...args);
  };
  store_default.subscribe((changed) => {
    if ("enableDebug" in changed) {
      debugEnabled = changed.enableDebug;
    }
  });
  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function extractSymbol(text) {
    const m = text.match(/[£$€]/);
    return m ? m[0] : null;
  }
  function getRandomTimeoutMs() {
    const MAX_TIMEOUT = 5;
    const MIN_TIMEOUT = 3;
    return (Math.floor(Math.random() * (MAX_TIMEOUT - MIN_TIMEOUT)) + MIN_TIMEOUT) * 60 * 1e3;
  }
  function scheduleTimeout(fn, delay = 300) {
    let timeout = null;
    const run = () => {
      timeout = setTimeout(() => {
        timeout = null;
        fn();
      }, delay);
    };
    return {
      start() {
        if (!timeout) run();
      },
      reset() {
        if (timeout) clearTimeout(timeout);
        run();
      },
      clear() {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      }
    };
  }
  var fetchResources = (...args) => {
    let promise = null;
    return () => {
      if (!promise) {
        promise = (async () => {
          const entries = await Promise.all(
            args.map(async (name) => {
              const resource = await GM.getResourceUrl(name);
              return [name, resource];
            })
          );
          const resources = {};
          for (const [name, resource] of entries) {
            if (resource) resources[name] = resource;
          }
          return resources;
        })();
      }
      return promise;
    };
  };
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  async function runEnhancements() {
    log("Running enhancements...");
    const {
      enableCurrencyConversion,
      enableHighlightRates,
      enableSurveyLinks,
      enableNewSurveyNotifications,
      ui: { hidden }
    } = await store_default.get([
      "enableCurrencyConversion",
      "enableHighlightRates",
      "enableSurveyLinks",
      "enableNewSurveyNotifications",
      "ui"
    ]);
    await Promise.all([
      !enableCurrencyConversion && convertCurrencyEnhancement.revert(),
      !enableHighlightRates && highlightRatesEnhancement.revert(),
      !enableSurveyLinks && surveyLinksEnhancement.revert(),
      !enableNewSurveyNotifications && newSurveyNotificationsEnhancement.revert(),
      hidden && uiEnhancement.revert()
    ]);
    if (enableCurrencyConversion) {
      await updateRates();
    }
    await Promise.all([
      enableCurrencyConversion && convertCurrencyEnhancement.apply(),
      enableHighlightRates && highlightRatesEnhancement.apply(),
      enableSurveyLinks && surveyLinksEnhancement.apply(),
      enableNewSurveyNotifications && newSurveyNotificationsEnhancement.apply(),
      !hidden && uiEnhancement.apply()
    ]);
  }
  var getSharedResources = fetchResources("prolific", "cloudresearch");
  initDebug();

  // src/adapters/ProlificAdapter.ts
  var PROLIFIC_SETTINGS = {
    enableInterval: false
  };
  var ProlificAdapter = class extends BaseAdapter {
    constructor(overrides = {}) {
      super(PROLIFIC_SETTINGS, overrides);
    }
    getSurveyElements() {
      return document.querySelectorAll(
        'li[data-testid^="study-"]'
      );
    }
    getSurveyId(el) {
      return el.getAttribute("data-testid")?.replace("study-", "") ?? null;
    }
    getSurveyContainer(el) {
      return el.querySelector("div.study-content");
    }
    getStudyTitle(el) {
      return el.querySelector("h2") ?? null;
    }
    getInitCurrencyInfo(el) {
      return extractSymbol(el.textContent) ?? null;
    }
    getCurrencyInfo(el) {
      let displaySymbol = Array.from(el.classList).find(
        (className) => className.includes("current-")
      );
      if (displaySymbol)
        displaySymbol = displaySymbol.replace("current-", "");
      let sourceSymbol = Array.from(el.classList).find(
        (className) => className.includes("source-")
      );
      if (sourceSymbol) sourceSymbol = sourceSymbol.replace("source-", "");
      return {
        displaySymbol: displaySymbol ?? null,
        sourceSymbol: sourceSymbol ?? null
      };
    }
    getRewardElements() {
      return Array.from(
        document.querySelectorAll(
          "[data-testid='study-tag-reward-per-hour'], [data-testid='study-tag-reward']"
        )
      );
    }
    getRewardElement(el) {
      return el.querySelector("span.reward") ?? null;
    }
    getHourlyRateElements() {
      return Array.from(
        document.querySelectorAll(
          "[data-testid='study-tag-reward-per-hour']"
        )
      );
    }
    setHourlyRate(el) {
    }
  };

  // src/adapters/CloudResearchAdapter.ts
  var CLOUD_RESEARCH_SETTINGS = {
    enableInterval: true
  };
  var CloudResearchAdapter = class extends BaseAdapter {
    constructor(overrides = {}) {
      super(CLOUD_RESEARCH_SETTINGS, overrides);
    }
    getSurveyElements() {
      return document.querySelectorAll("div.project-card");
    }
    getSurveyId(el) {
      const surveyId = Array.from(el.classList).find(
        (className) => className.includes("project-card-")
      );
      if (surveyId) return surveyId.replace("project-card-", "");
      return null;
    }
    getSurveyContainer(el) {
      return el.querySelector("div.project-card");
    }
    getStudyTitle(el) {
      return el.querySelector("p") ?? null;
    }
    getInitCurrencyInfo(el) {
      return "$";
    }
    getCurrencyInfo(el) {
      let displaySymbol = Array.from(el.classList).find(
        (className) => className.includes("current-")
      );
      if (displaySymbol)
        displaySymbol = displaySymbol.replace("current-", "");
      return {
        displaySymbol: displaySymbol ?? null,
        // CloudResearch uses USD by default
        sourceSymbol: "$"
      };
    }
    getRewardElements() {
      return Array.from(
        document.querySelectorAll(
          '[class*="project-pay-per-hour-"] > *'
        )
      );
    }
    getRewardElement(el) {
      return el.querySelector('[class*="project-pay-per-hour-"]')?.firstElementChild ?? null;
    }
    getHourlyRateElements() {
      return Array.from(
        document.querySelectorAll(
          '[class*="project-pay-per-hour-"]'
        )
      ).filter((node) => node.textContent.includes("per hour"));
    }
    setHourlyRate(element) {
    }
  };

  // src/config.ts
  var siteAdapters = {
    prolific: new ProlificAdapter(),
    cloudresearch: new CloudResearchAdapter()
  };
  function getSiteAdapter() {
    const host = window.location.hostname;
    for (const key of Object.keys(siteAdapters)) {
      if (host.includes(key))
        return {
          siteName: key,
          adapter: siteAdapters[key]
        };
    }
    throw new Error(`Extension injected on unsupported host: ${host}`);
  }
  var config_default = getSiteAdapter;

  // src/features/enhancement.ts
  var Enhancement = class {
    siteName;
    siteAdapter;
    constructor() {
      const { siteName, adapter } = config_default();
      this.siteName = siteName;
      this.siteAdapter = adapter;
    }
  };

  // src/features/links.ts
  var SurveyLinksEnhancement = class extends Enhancement {
    constructor() {
      super();
    }
    apply() {
      const surveys = this.siteAdapter.getSurveyElements();
      for (const survey of surveys) {
        const surveyId = this.siteAdapter.getSurveyId(survey);
        const studyContent = this.siteAdapter.getSurveyContainer(survey);
        if (studyContent && !studyContent.querySelector(".pe-link")) {
          const container = document.createElement("div");
          const link = document.createElement("a");
          container.className = "pe-btn-container";
          container.appendChild(link);
          link.className = "pe-link pe-custom-btn";
          link.href = `https://app.prolific.com/studies/${surveyId}`;
          link.textContent = "Take part in this study";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          studyContent.appendChild(container);
        }
      }
    }
    revert() {
      const elements = document.querySelectorAll(".pe-btn-container");
      for (const el of elements) {
        if (!el) continue;
        el.remove();
      }
    }
  };
  var surveyLinksEnhancement = new SurveyLinksEnhancement();

  // src/constants.ts
  var NOTIFY_TTL_MS = 24 * 60 * 60 * 1e3;
  var CONVERSION_RATES_FETCH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1e3;
  var MIN_AMOUNT_PER_HOUR = 7;
  var MAX_AMOUNT_PER_HOUR = 15;

  // src/features/notifications.ts
  async function saveSurveyFingerprints(fingerprints) {
    const now = Date.now();
    const { surveys: immutableSurveys } = await store_default.get(["surveys"]);
    const prevSurveys = structuredClone(immutableSurveys);
    let changed = false;
    for (const [key, timestamp] of Object.entries(prevSurveys)) {
      if (now - timestamp >= NOTIFY_TTL_MS) {
        delete prevSurveys[key];
        changed = true;
      }
    }
    const newSurveys = [];
    for (const fingerprint of fingerprints) {
      if (!(fingerprint in prevSurveys)) {
        newSurveys.push(fingerprint);
      }
      prevSurveys[fingerprint] = now;
      changed = true;
    }
    if (changed) await store_default.set({ surveys: prevSurveys });
    return newSurveys;
  }
  var NewSurveyNotificationsEnhancement = class extends Enhancement {
    async apply() {
      const surveys = this.siteAdapter.getSurveyElements();
      if (surveys.length === 0) return;
      const assets = await getSharedResources();
      const surveyFingerprints = Array.from(surveys).map((survey) => this.siteAdapter.getSurveyId(survey)).filter((id) => id !== void 0);
      const newSurveys = await saveSurveyFingerprints(surveyFingerprints);
      for (const survey of surveys) {
        const surveyId = this.siteAdapter.getSurveyId(survey);
        if (!surveyId) continue;
        const isNewFingerprint = newSurveys.includes(surveyId);
        if (!isNewFingerprint || !document.hidden) continue;
        const surveyTitle = this.siteAdapter.getStudyTitle(survey)?.textContent;
        const rewardElement = this.siteAdapter.getRewardElement(survey);
        const rewardText = rewardElement?.textContent.match(/\d+(\.\d+)?/)?.[0] || "Unknown reward";
        if (!surveyId) continue;
        const surveyLink = `https://app.prolific.com/studies/${surveyId}`;
        const siteLabel = capitalize(this.siteName);
        GM.notification({
          title: surveyTitle || siteLabel,
          text: `${siteLabel} \u2022 ${rewardText}`,
          image: assets[this.siteName]
          // TODO: Update survey links
          // onclick: () =>
          //     GM.openInTab(surveyLink, {
          //         active: true,
          //     }),
        });
      }
    }
    revert() {
    }
  };
  var newSurveyNotificationsEnhancement = new NewSurveyNotificationsEnhancement();

  // src/features/rates.ts
  async function fetchRates() {
    const { timestamp, ...conversionRates } = structuredClone(
      defaultVMSettings.conversionRates
    );
    const currencies = Object.keys(
      conversionRates
    );
    const responses = await Promise.all(
      currencies.map(async (currency) => {
        try {
          const res = await fetch(
            `https://open.er-api.com/v6/latest/${currency}`
          );
          const data = await res.json();
          return { currency, data };
        } catch {
          return null;
        }
      })
    );
    for (const resp of responses) {
      if (!resp) continue;
      const { currency, data } = resp;
      for (const c of currencies) {
        if (c === currency) continue;
        conversionRates[currency].rates[c] = data.rates[c];
      }
    }
    return conversionRates;
  }
  async function updateRates() {
    const { conversionRates } = await store_default.get(["conversionRates"]);
    const now = Date.now();
    if (now - conversionRates.timestamp < CONVERSION_RATES_FETCH_INTERVAL_MS)
      return;
    const newConversionRates = await fetchRates();
    newConversionRates.timestamp = now;
    await store_default.set({
      conversionRates: newConversionRates
    });
  }
  function extractHourlyRate(text) {
    const m = text.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : NaN;
  }
  function rateToColor(rate, min = 7, max = 15) {
    const clamped = Math.min(Math.max(rate, min), max);
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    const logRate = Math.log(clamped);
    const ratio = (logRate - logMin) / (logMax - logMin);
    const bias = Math.pow(ratio, 0.6);
    const r = Math.round(255 * (1 - bias));
    const g = Math.round(255 * bias);
    return `rgba(${r}, ${g}, 0, 0.63)`;
  }
  function extractSymbol3(text) {
    const m = text.match(/[£$€]/);
    return m ? m[0] : null;
  }
  function getSymbol(currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).formatToParts(0).find((part) => part.type === "currency")?.value;
  }
  var ConvertCurrencyEnhancement = class extends Enhancement {
    async apply() {
      const elements = this.siteAdapter.getRewardElements();
      const { selectedCurrency, conversionRates } = await store_default.get([
        "selectedCurrency",
        "conversionRates"
      ]);
      const selectedSymbol = getSymbol(selectedCurrency);
      const rate = selectedCurrency === "USD" ? conversionRates.GBP.rates.USD : conversionRates.USD.rates.GBP;
      for (const element of elements) {
        let sourceText = element.getAttribute("data-original-text");
        if (!sourceText) {
          element.setAttribute(
            "data-original-text",
            element.textContent || ""
          );
          sourceText = element.textContent || "";
          const sourceSymbol2 = this.siteAdapter.getInitCurrencyInfo(element);
          element.classList.add(`source-${sourceSymbol2}`);
        }
        const { sourceSymbol, displaySymbol } = this.siteAdapter.getCurrencyInfo(element);
        if (sourceSymbol === selectedSymbol) {
          if (element.textContent !== sourceText) {
            element.textContent = sourceText;
          }
          const previousClassName2 = Array.from(element.classList).find(
            (className) => className.includes("current-")
          );
          if (previousClassName2) {
            element.classList.remove(previousClassName2);
          }
          continue;
        }
        if (displaySymbol === selectedSymbol) continue;
        const previousClassName = Array.from(element.classList).find(
          (className) => className.includes("current-")
        );
        if (previousClassName) element.classList.remove(previousClassName);
        element.classList.add(`current-${selectedSymbol}`);
        const elementRate = extractHourlyRate(sourceText);
        const converted = `${selectedSymbol}${(elementRate * rate).toFixed(2)}`;
        element.textContent = sourceText.replace(
          /[$£€]?\s*\d+(?:\.\d+)?/,
          converted
        );
      }
    }
    revert() {
      document.querySelectorAll("[data-original-text]").forEach((el) => {
        el.textContent = el.getAttribute("data-original-text") || "";
        el.removeAttribute("data-original-text");
      });
    }
  };
  var HighlightRatesEnhancement = class extends Enhancement {
    async apply() {
      const elements = this.siteAdapter.getHourlyRateElements();
      for (const element of elements) {
        if (element.classList.contains("pe-rate-highlight")) {
          continue;
        }
        const rate = extractHourlyRate(element.textContent);
        const symbol = extractSymbol3(element.textContent);
        if (isNaN(rate) || !symbol) return;
        const { conversionRates } = await store_default.get(["conversionRates"]);
        const min = symbol === "$" ? MIN_AMOUNT_PER_HOUR : MIN_AMOUNT_PER_HOUR * conversionRates.USD.rates.GBP;
        const max = symbol === "$" ? MAX_AMOUNT_PER_HOUR : MAX_AMOUNT_PER_HOUR * conversionRates.USD.rates.GBP;
        element.style.backgroundColor = rateToColor(rate, min, max);
        if (!element.classList.contains("pe-rate-highlight"))
          element.classList.add("pe-rate-highlight");
      }
    }
    revert() {
      const elements = document.querySelectorAll(".pe-rate-highlight");
      for (const el of elements) {
        if (!el) continue;
        el.style.backgroundColor = "";
        el.classList.remove("pe-rate-highlight");
      }
    }
  };
  var highlightRatesEnhancement = new HighlightRatesEnhancement();
  var convertCurrencyEnhancement = new ConvertCurrencyEnhancement();

  // src/features/ui.ts
  function formatSettingString(setting) {
    return setting.replace("enable", "").split(/(?=[A-Z])/).join(" ");
  }
  var UIEnhancement = class {
    controller;
    constructor() {
      this.controller = new AbortController();
    }
    async apply() {
      if (document.querySelector("#pe-ui-container")) return;
      const body = document.querySelector("body");
      const container = document.createElement("div");
      body?.appendChild(container);
      container.id = "pe-ui-container";
      const title = document.createElement("div");
      container?.appendChild(title);
      title.id = "pe-ui-title";
      title.textContent = "Prolific Enhancer Settings";
      const settingsContainer = document.createElement("div");
      container?.appendChild(settingsContainer);
      settingsContainer.id = "pe-settings-container";
      const settings = await store_default.get(
        Object.keys(
          defaultVMSettings
        )
      );
      const createSettingElement = (labelText, buttonText, setting, onClick) => {
        const toggleContainer = document.createElement("div");
        toggleContainer.className = "pe-setting-item";
        toggleContainer.dataset.setting = setting;
        const toggleButton = document.createElement("button");
        const label = document.createElement("div");
        label.textContent = labelText;
        toggleButton.textContent = buttonText;
        toggleContainer.append(label, toggleButton);
        toggleButton.addEventListener("click", onClick);
        return toggleContainer;
      };
      const { selectedCurrency } = settings;
      const toggleElement = createSettingElement(
        "Selected Currency",
        `${selectedCurrency}`,
        "selectedCurrency",
        async () => {
          const { selectedCurrency: selectedCurrency2 } = await store_default.get([
            "selectedCurrency"
          ]);
          await store_default.set({
            selectedCurrency: selectedCurrency2 === "USD" ? "GBP" : "USD"
          });
        }
      );
      settingsContainer.append(toggleElement);
      const toggleSettings = Object.keys(settings).filter(
        (key) => key.startsWith("enable")
      );
      for (const setting of toggleSettings) {
        const formattedSettingName = formatSettingString(setting);
        const toggleElement2 = createSettingElement(
          formattedSettingName,
          `${settings[setting] ? "Disable" : "Enable"} ${formattedSettingName}`,
          setting,
          async () => {
            const current = await store_default.get([setting]);
            await store_default.set({
              [setting]: !current[setting]
            });
          }
        );
        settingsContainer.append(toggleElement2);
      }
      const {
        ui: {
          initialized,
          position: { left, top }
        }
      } = await store_default.get(["ui"]);
      Object.assign(container.style, {
        // Set to center if position is not initialized
        left: `${!initialized ? window.innerWidth / 2 : left}px`,
        top: `${!initialized ? window.innerHeight / 2 : top}px`
      });
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;
      const { signal } = this.controller;
      const updatePosition = (x, y) => {
        const { left: left2, top: top2, width, height } = container.getBoundingClientRect();
        container.style.left = `${clamp(x ?? left2, 0, window.innerWidth - width)}px`;
        container.style.top = `${clamp(y ?? top2, 0, window.innerHeight - height)}px`;
      };
      container.addEventListener(
        "mousedown",
        (e) => {
          e.preventDefault();
          isDragging = true;
          container.style.cursor = "grabbing";
          const { left: left2, top: top2 } = container.getBoundingClientRect();
          offsetX = e.clientX - left2;
          offsetY = e.clientY - top2;
          updatePosition(left2, top2);
        },
        { signal }
      );
      window.addEventListener("resize", () => updatePosition(), { signal });
      document.addEventListener(
        "mousemove",
        (e) => {
          if (!isDragging) return;
          updatePosition(e.clientX - offsetX, e.clientY - offsetY);
        },
        { signal }
      );
      document.addEventListener(
        "mouseup",
        () => {
          isDragging = false;
          container.style.cursor = "grab";
          const { left: left2, top: top2 } = container.getBoundingClientRect();
          store_default.update({
            ui: {
              initialized: true,
              position: { left: left2, top: top2 }
            }
          });
        },
        { signal }
      );
    }
    update(changed) {
      if (!document.getElementById("pe-ui-container")) return;
      const settingsElements = document.querySelectorAll(
        ".pe-setting-item[data-setting]"
      );
      if (settingsElements.length === 0) return;
      const keys = Object.keys(changed);
      for (const el of settingsElements) {
        const setting = el.dataset.setting;
        if (!keys.includes(setting)) continue;
        if (changed.selectedCurrency && setting === "selectedCurrency") {
          const { selectedCurrency } = changed;
          const button = el.querySelector("button");
          if (!button) continue;
          button.textContent = `${selectedCurrency}`;
        }
        if (setting.startsWith("enable")) {
          const value = changed[setting];
          const button = el.querySelector("button");
          if (!button) continue;
          const formattedSettingName = formatSettingString(setting);
          button.textContent = `${value ? "Disable" : "Enable"} ${formattedSettingName}`;
        }
      }
    }
    async revert() {
      const container = document.getElementById("pe-ui-container");
      container?.remove();
      this.controller.abort();
      this.controller = new AbortController();
    }
  };
  var uiEnhancement = new UIEnhancement();

  // src/main.ts
  (async function() {
    "use strict";
    log("Loaded.");
    GM.addStyle(`
        .pe-custom-btn {
            padding: 8px 24px;
            border-radius: 4px;
            font-size: 0.9em;
            background-color: #0a3c95;
            color: white;
            cursor: pointer;
            text-decoration: none;
        }
        .pe-custom-btn:hover {
            background-color: #0d4ebf;
            color: white !important;
        }
        .pe-btn-container {
            padding: 0 16px 8px 16px;
        }
        .pe-rate-highlight {
            padding: 3px 4px;
            border-radius: 4px;
            color: black;
        }
        .pe-settings-item {
            display: flex;
        }
        #pe-ui-container {
            position: fixed;
            bottom: auto;
            right: auto;
            min-width: 260px;
            background: rgba(30, 30, 30, 0.9);
            color: white;
            border-radius: 4px;
            padding: 3px 4px;
            z-index: 10000;
            cursor: grab;
            user-select: none;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        #pe-ui-container:active #pe-ui-title {
            cursor: grabbing;
        }
        #pe-settings-container {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            gap: 10px;
            min-height: 120px;
        }
        #pe-ui-title {
            font-weight: bold;
            text-align: center;
            font-size: 0.8em;
            letter-spacing: 0.3px;
            background: #0a3c95;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            cursor: grab;
            user-select: none;
        }
    `);
    function debounce(fn, delay = 300) {
      let timeoutId;
      let runId = 0;
      return (...args) => {
        runId++;
        const currentRun = runId;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (currentRun !== runId) return;
          Promise.resolve(fn(...args)).catch(console.error);
        }, delay);
      };
    }
    await runEnhancements();
    const debounced = debounce(async () => {
      await runEnhancements();
    }, 300);
    const observer = new MutationObserver((mutations) => {
      const hasChanges = mutations.some(
        (m) => m.addedNodes.length > 0 || m.removedNodes.length > 0
      );
      if (!hasChanges) return;
      debounced();
    });
    const config = { childList: true, subtree: true };
    observer.observe(document.body, config);
    const ms = getRandomTimeoutMs();
    const pageReloadTimeout = scheduleTimeout(() => {
      if (!document.hidden) {
        pageReloadTimeout.reset();
        return;
      }
      log("Refreshing page...");
      location.reload();
    }, ms);
    const { siteName, adapter } = config_default();
    if (adapter.settings.enableInterval) {
      log("Page refresh scheduled.");
      pageReloadTimeout.start();
    }
    function createMenuCommandRefresher() {
      const commandIds = [];
      return async function refreshMenuCommands2() {
        for (const id2 of commandIds) {
          GM.unregisterMenuCommand(id2);
        }
        commandIds.length = 0;
        const {
          ui: { hidden }
        } = await store_default.get(["ui"]);
        const id = GM.registerMenuCommand(
          `${hidden ? "Show" : "Hide"} Settings UI`,
          async () => {
            await store_default.update({ ui: { hidden: !hidden } });
          }
        );
        commandIds.push(id);
      };
    }
    const refreshMenuCommands = createMenuCommandRefresher();
    await refreshMenuCommands();
    const unsubscribe = store_default.subscribe(async (changed) => {
      const keys = Object.keys(changed);
      if (keys.length === 1 && keys[0] === "surveys") return;
      if (changed.ui) await refreshMenuCommands();
      debounced();
      uiEnhancement.update(changed);
    });
  })();
})();
