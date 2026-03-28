(function () {
  const DEFAULT_CONFIG = {
    host: "127.0.0.1",
    port: 8080,
    secure: false,
    password: "",
    reconnectDelayMs: 3500,
    requestTimeoutMs: 6000,
    heartbeatIntervalMs: 20000,
    staleAfterSec: 180,
    maxMessages: 0,
    enabledPlatforms: ["youtube", "kick", "twitch", "streamlabs", "streamelements"],
    toastDurationMs: 6500,
    ignoreUsers: [],
    ignoreBangCommands: false,
    fontSize: null,
    usernameFontSize: null,
    supporterNameFontSize: null,
    memberNameFontSize: null,
    timeFontSize: null,
    showStatus: true,
    backgroundColor: "#000000",
    backgroundOpacity: 1,
    hideDeletedMessages: false,
    localOnly: false,
    trainOnly: false,
    trainPosition: "bottom-left",
    trainWidth: null,
    trainScale: 1,
    trainCompact: false,
    twitchClientId: "7ms113c5vj9g8kdesoxbpv38qfw1vw",
    twitchAccessToken: "dvxcgtp2dtau85g0exztwrrgnkj3mt",
    showModerationControls: false,
    moderationDeleteAction: "Overlay Mod - Delete Message",
    moderationPinAction: "Overlay Mod - Pin Message",
    moderationTimeoutAction: "Overlay Mod - Timeout User",
    moderationBanAction: "Overlay Mod - Ban User",
    sendMessageAction: "Overlay Mod - Send Message",
    moderationTimeoutSeconds: 600,
  };

  const BOOT_CONFIG = (window.__OVERLAY_BOOT_CONFIG__ && typeof window.__OVERLAY_BOOT_CONFIG__ === "object")
    ? window.__OVERLAY_BOOT_CONFIG__
    : {};
  const OVERLAY_ASSETS = (window.__OVERLAY_ASSETS__ && typeof window.__OVERLAY_ASSETS__ === "object")
    ? window.__OVERLAY_ASSETS__
    : {};

  const PLATFORM_META = {
    streamerbot: { label: "Streamer.bot", color: "#6ee7ff", short: "SB" },
    youtube: { label: "YouTube", color: "#ff495e", short: "YT", eventSource: "YouTube" },
    kick: { label: "Kick", color: "#53fc18", short: "K", eventSource: "Kick" },
    twitch: { label: "Twitch", color: "#a576ff", short: "TW", eventSource: "Twitch" },
    streamlabs: { label: "Streamlabs", color: "#38bdf8", short: "SL", eventSource: "Streamlabs" },
    streamelements: { label: "StreamElements", color: "#ffd166", short: "SE", eventSource: "StreamElements" },
    kofi: { label: "Ko-fi", color: "#ff5e5b", short: "KF", eventSource: "Kofi" },
    fourthwall: { label: "Fourthwall", color: "#f4a261", short: "FW", eventSource: "Fourthwall" },
  };

  const EVENT_SUBSCRIPTIONS = {
    Twitch: ["ChatMessage", "ChatMessageDeleted", "BroadcasterChatConnected", "BroadcasterChatDisconnected", "ViewerCountUpdate", "Follow", "Raid", "RewardRedemption", "Cheer", "Sub", "ReSub", "GiftSub", "GiftBomb", "CoinCheer", "CharityDonation", "HypeTrainStart", "HypeTrainUpdate", "HypeTrainLevelUp", "HypeTrainEnd"],
    Kick: ["ChatMessage", "BroadcasterChatConnected", "BroadcasterChatDisconnected", "ViewerCountUpdate", "PresentViewers", "Follow", "RewardRedemption", "Subscription", "Resubscription", "GiftSubscription", "MassGiftSubscription", "sGifted", "KicksGifted"],
    YouTube: ["Message", "SuperChat", "SuperSticker", "BroadcastMonitoringStarted", "BroadcastMonitoringEnded", "BroadcastStarted", "BroadcastEnded", "PresentViewers", "StatisticsUpdated", "NewSubscriber", "NewSponsor", "MembershipGift", "GiftMembershipReceived"],
    Streamlabs: ["Connected", "Authenticated", "Disconnected", "Donation", "Merchandise"],
    StreamElements: ["Tip", "Connected", "Disconnected", "Authenticated"],
    Kofi: ["Donation", "Subscription", "Resubscription"],
    Fourthwall: ["Donation", "SubscriptionPurchased", "GiftPurchase"],
  };

  const HISTORY_STORAGE_KEY = "sb-multichat-history-v2";
  const HISTORY_API_PATH = "/api/history";
  const HISTORY_STREAM_PATH = "/api/history/stream";
  const SETTINGS_API_PATH = "/api/settings";
  const RUNTIME_STATE_API_PATH = "/api/runtime-state";
  const TRAIN_STATUS_API_PATH = "/api/train-status";
  const YOUTUBE_DEBUG_API_PATH = "/api/debug/youtube-message";
  const RUNTIME_DEBUG_API_PATH = "/api/debug/runtime";
  const KICK_VIEWER_DEBUG_API_PATH = "/api/debug/kick-viewer";
  const KICK_GIFTS_DEBUG_API_PATH = "/api/debug/kick-gifts";
  const YOUTUBE_PAID_DEBUG_API_PATH = "/api/debug/youtube-paid";
  const GIFT_RECIPIENT_DEBUG_API_PATH = "/api/debug/gift-recipient";
  const PARSE_FAILURE_DEBUG_API_PATH = "/api/debug/parse-failures";
  const HISTORY_SYNC_INTERVAL_MS = 2500;
  const HISTORY_STREAM_BACKUP_POLL_MS = 15000;
  const SUPPORT_TRAIN_WINDOW_MS = 90000;
  const SUPPORT_TRAIN_TRIGGER_POINTS = 22;
  const SUPPORT_TRAIN_LEVEL_THRESHOLDS = [22, 90, 220, 420, 760, 1250, 1900];
  const MEMBER_BADGE_IMAGE = OVERLAY_ASSETS.memberBadgeLogo || "./assets/member-badge-logo.png";
  const LUCIDPAY_STATUS_ICON = OVERLAY_ASSETS.lucidpayStatusIcon || "./assets/lucidpay-status-icon.png";
  const YOUTUBE_SUPER_STICKER_MAP_PATH = OVERLAY_ASSETS.youtubeSuperStickerMapPath || "./data/youtube-super-stickers.json";
  const REMOVED_MESSAGES_STORAGE_KEY = "sb-multichat-removed-v1";
  const LEGACY_REMOVED_MESSAGES_STORAGE_KEY = `sb-multichat-removed-v1:${window.location.search || "default"}`;
  const PERFORMANCE_SETTINGS_STORAGE_KEY = "sb-multichat-performance-v1";
  const OVERLAY_SETTINGS_STORAGE_KEY = "sb-multichat-overlay-settings-v1";
  const SUPPORT_TRAIN_STORAGE_KEY = "sb-multichat-support-train-v1";
  const SUPPORT_TRAIN_MESSAGE_LOCK_KEY = "sb-multichat-support-train-message-lock-v1";
  const PLATFORM_RUNTIME_STORAGE_KEY = "sb-multichat-platform-runtime-v1";
  const RUNTIME_SYNC_CHANNEL_NAME = "sb-multichat-runtime-v1";
  const USERNAME_COLOR_PALETTE = [
    "#8AB4F8",
    "#F28B82",
    "#81C995",
    "#FDD663",
    "#C58AF9",
    "#78D9EC",
    "#F6AEA9",
    "#A8C7FA",
    "#F9ABCD",
    "#9DD56C",
    "#FFB870",
    "#9CCBFF",
  ];
  const KICK_GIFT_CATALOG = {
    1: { id: "hell-yeah", name: "Hell Yeah" },
    10: { id: "hype", name: "Hype" },
    50: { id: "skull-emoji", name: "Skull Emoji" },
    100: { id: "full-send", name: "Full Send" },
    500: { id: "rage-quit", name: "Rage Quit" },
    1000: { id: "pack-it-up", name: "Pack It Up" },
    2000: { id: "yap", name: "YAP" },
    5000: { id: "stomp", name: "Stomp" },
    10000: { id: "flex", name: "Flex" },
    50000: { id: "boom", name: "BOOOOOM" },
  };

  const config = loadConfig();
  const staleAfterMs = config.staleAfterSec * 1000;
  const renderedMessageLimit = config.showModerationControls ? 220 : 100;

  const state = {
    socket: null,
    reconnectTimer: null,
    requestCounter: 0,
    pendingRequests: new Map(),
    connectedAt: null,
    lastSocketActivityAt: 0,
    lastLiveEventAt: 0,
    lastSocketError: null,
    setupComplete: false,
    setupInFlight: false,
    internetOnline: navigator.onLine !== false,
    heartbeatInFlight: false,
    platforms: buildPlatformState(),
    broadcasters: {},
    feedItems: [],
    toasts: [],
    scrollPaused: false,
    pausedNewCount: 0,
    suppressScrollPauseUntil: 0,
    initialAutoFollowUntil: 0,
    historySyncInFlight: false,
    historyEventSource: null,
    historyStreamConnected: false,
    lastHistoryRealtimeAt: 0,
    lastHistoryPollAt: 0,
    removedMessageIds: new Set(),
    twitchAvatarCache: new Map(),
    twitchAvatarPending: new Set(),
    twitchAvatarLookupUnavailable: false,
    moderationDialog: null,
    moderationBusy: false,
    sendMessageBusy: false,
    testAlertsBusy: false,
    pendingRenderQueue: [],
    renderFlushHandle: 0,
    scrollAfterFlush: false,
    cardCleanup: new WeakMap(),
    liteEffects: loadLiteEffectsPreference(),
    feedClearedBefore: 0,
    overlaySettings: loadOverlaySettings(),
    settingsDialogOpen: false,
    settingsActiveTab: "stream",
    youtubeStickerMap: null,
    youtubeStickerMapPromise: null,
    youtubeStickerMapLastAttemptAt: 0,
    supportTrain: createSupportTrainState(),
    trainTestStepIndex: 0,
    trainTestBusy: false,
    runtimeChannel: null,
    resumeRecoveryTimer: 0,
    liveRecoveryInFlight: false,
  };

  const ui = {
    statusStrip: document.getElementById("status-strip"),
    statusItems: document.getElementById("status-items"),
    toastStack: document.getElementById("status-toast-stack"),
    chatFeed: document.getElementById("chat-feed"),
    pauseBanner: document.getElementById("feed-pause-banner"),
    pauseCount: document.getElementById("feed-pause-count"),
    performanceControls: document.getElementById("performance-controls"),
    supportTrainHud: document.getElementById("support-train-hud"),
    supportTrainBadge: document.getElementById("support-train-badge"),
    supportTrainIcon: document.getElementById("support-train-icon"),
    supportTrainTitle: document.getElementById("support-train-title"),
    supportTrainSubtitle: document.getElementById("support-train-subtitle"),
    supportTrainLevel: document.getElementById("support-train-level"),
    supportTrainTime: document.getElementById("support-train-time"),
    supportTrainBarFill: document.getElementById("support-train-bar-fill"),
    supportTrainPoints: document.getElementById("support-train-points"),
    supportTrainLatest: document.getElementById("support-train-latest"),
    overlaySettingsButton: document.getElementById("overlay-settings-button"),
    overlaySettingsBackdrop: document.getElementById("overlay-settings-backdrop"),
    overlaySettingsClose: document.getElementById("overlay-settings-close"),
    settingsTabs: Array.from(document.querySelectorAll("[data-settings-tab]")),
    settingsPanels: Array.from(document.querySelectorAll("[data-settings-panel]")),
    settingsTestActions: Array.from(document.querySelectorAll("[data-test-keys]")),
    settingsStreamLiteEffects: document.getElementById("settings-stream-lite-effects"),
    settingsStreamFollowAlerts: document.getElementById("settings-stream-follow-alerts"),
    settingsStreamIgnoreBang: document.getElementById("settings-stream-ignore-bang"),
    settingsStreamHideDeleted: document.getElementById("settings-stream-hide-deleted"),
    settingsStreamShowStatus: document.getElementById("settings-stream-show-status"),
    settingsDockLiteEffects: document.getElementById("settings-dock-lite-effects"),
    settingsDockFollowAlerts: document.getElementById("settings-dock-follow-alerts"),
    settingsDockIgnoreBang: document.getElementById("settings-dock-ignore-bang"),
    settingsDockHideDeleted: document.getElementById("settings-dock-hide-deleted"),
    settingsDockShowStatus: document.getElementById("settings-dock-show-status"),
    settingsIgnoreUsersStream: document.getElementById("settings-ignore-users-stream"),
    settingsIgnoreUsersDock: document.getElementById("settings-ignore-users-dock"),
    settingsTrainPosition: document.getElementById("settings-train-position"),
    settingsTrainWidth: document.getElementById("settings-train-width"),
    settingsTrainScale: document.getElementById("settings-train-scale"),
    settingsTrainCompact: document.getElementById("settings-train-compact"),
    settingsTrainStep: document.getElementById("settings-train-step"),
    settingsTrainReset: document.getElementById("settings-train-reset"),
    settingsClearFeed: document.getElementById("settings-clear-feed"),
    settingsSave: document.getElementById("settings-save"),
    template: document.getElementById("message-template"),
    moderationModalBackdrop: document.getElementById("moderation-modal-backdrop"),
    moderationModalText: document.getElementById("moderation-modal-text"),
    moderationModalConfirm: document.getElementById("moderation-modal-confirm"),
    moderationModalCancel: document.getElementById("moderation-modal-cancel"),
    moderationModalClose: document.getElementById("moderation-modal-close"),
    dockComposer: document.getElementById("dock-composer"),
    dockComposerPlatform: document.getElementById("dock-composer-platform"),
    dockComposerInput: document.getElementById("dock-composer-input"),
    dockComposerButton: document.getElementById("dock-composer-button"),
  };

  const LIVE_SCROLL_THRESHOLD = 72;

  initialize();

  function loadConfig() {
    const params = new URLSearchParams(window.location.search);
    const platforms = params.get("platforms");
    const ignoreUsersParam = params.get("ignoreUsers") || params.get("ignoreChatters") || "";
    const bootPlatforms = Array.isArray(BOOT_CONFIG.enabledPlatforms) ? BOOT_CONFIG.enabledPlatforms : DEFAULT_CONFIG.enabledPlatforms;
    const enabledPlatforms = platforms
      ? platforms.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
      : [...bootPlatforms];

    if (!enabledPlatforms.includes("streamlabs")) {
      enabledPlatforms.push("streamlabs");
    }

    if (!enabledPlatforms.includes("streamelements")) {
      enabledPlatforms.push("streamelements");
    }

    return {
      host: params.get("host") || BOOT_CONFIG.host || DEFAULT_CONFIG.host,
      port: Number(params.get("port") || BOOT_CONFIG.port || DEFAULT_CONFIG.port),
      secure: params.get("secure") === "true" || params.get("scheme") === "wss" || !!BOOT_CONFIG.secure,
      password: params.get("password") || BOOT_CONFIG.password || DEFAULT_CONFIG.password,
      reconnectDelayMs: Number(params.get("reconnectDelayMs") || BOOT_CONFIG.reconnectDelayMs || DEFAULT_CONFIG.reconnectDelayMs),
      requestTimeoutMs: Number(params.get("requestTimeoutMs") || BOOT_CONFIG.requestTimeoutMs || DEFAULT_CONFIG.requestTimeoutMs),
      heartbeatIntervalMs: Number(params.get("heartbeatIntervalMs") || BOOT_CONFIG.heartbeatIntervalMs || DEFAULT_CONFIG.heartbeatIntervalMs),
      staleAfterSec: Number(params.get("staleAfterSec") || BOOT_CONFIG.staleAfterSec || DEFAULT_CONFIG.staleAfterSec),
      maxMessages: Number(params.get("maxMessages") || BOOT_CONFIG.maxMessages || DEFAULT_CONFIG.maxMessages),
      toastDurationMs: Number(params.get("toastDurationMs") || BOOT_CONFIG.toastDurationMs || DEFAULT_CONFIG.toastDurationMs),
      ignoreUsers: ignoreUsersParam
        .split(",")
        .map((value) => normalizeUserName(value))
        .filter(Boolean)
        .concat(Array.isArray(BOOT_CONFIG.ignoreUsers) ? BOOT_CONFIG.ignoreUsers.map((value) => normalizeUserName(value)).filter(Boolean) : []),
      ignoreBangCommands: readBooleanParam(params, ["ignoreBangCommands", "ignoreCommands", "excludeCommands"], BOOT_CONFIG.ignoreBangCommands ?? DEFAULT_CONFIG.ignoreBangCommands),
      fontSize: readOptionalPixelParam(params, ["fontSize", "messageFontSize"], BOOT_CONFIG.fontSize ?? DEFAULT_CONFIG.fontSize),
      usernameFontSize: readOptionalPixelParam(params, ["usernameFontSize"], BOOT_CONFIG.usernameFontSize ?? DEFAULT_CONFIG.usernameFontSize),
      supporterNameFontSize: readOptionalPixelParam(params, ["supporterNameFontSize"], BOOT_CONFIG.supporterNameFontSize ?? DEFAULT_CONFIG.supporterNameFontSize),
      memberNameFontSize: readOptionalPixelParam(params, ["memberNameFontSize"], BOOT_CONFIG.memberNameFontSize ?? DEFAULT_CONFIG.memberNameFontSize),
      timeFontSize: readOptionalPixelParam(params, ["timeFontSize"], BOOT_CONFIG.timeFontSize ?? DEFAULT_CONFIG.timeFontSize),
      showStatus: !readBooleanParam(params, ["hideStatus", "hidePlatforms", "hidePlatform"], false) &&
        readBooleanParam(params, ["showStatus", "showPlatforms"], BOOT_CONFIG.showStatus ?? DEFAULT_CONFIG.showStatus),
      backgroundColor: readColorParam(params, ["backgroundColor", "background"], BOOT_CONFIG.backgroundColor ?? DEFAULT_CONFIG.backgroundColor),
      backgroundOpacity: readOpacityParam(params, ["backgroundOpacity", "bgOpacity", "opacity"], BOOT_CONFIG.backgroundOpacity ?? DEFAULT_CONFIG.backgroundOpacity),
      hideDeletedMessages: readBooleanParam(params, ["hideDeletedMessages", "removeDeletedMessages"], BOOT_CONFIG.hideDeletedMessages ?? DEFAULT_CONFIG.hideDeletedMessages),
      localOnly: readBooleanParam(params, ["localOnly"], BOOT_CONFIG.localOnly ?? DEFAULT_CONFIG.localOnly),
      trainOnly: readBooleanParam(params, ["trainOnly", "hypeTrainOnly"], BOOT_CONFIG.trainOnly ?? DEFAULT_CONFIG.trainOnly),
      trainPosition: readEnumParam(params, ["trainPosition", "position"], ["top-left", "bottom-left", "bottom-center"], BOOT_CONFIG.trainPosition ?? DEFAULT_CONFIG.trainPosition),
      trainWidth: readOptionalPixelParam(params, ["trainWidth", "width"], BOOT_CONFIG.trainWidth ?? DEFAULT_CONFIG.trainWidth),
      trainScale: readNumberParam(params, ["trainScale", "scale"], BOOT_CONFIG.trainScale ?? DEFAULT_CONFIG.trainScale, { min: 0.4, max: 2.5 }),
      trainCompact: readBooleanParam(params, ["trainCompact", "compact"], BOOT_CONFIG.trainCompact ?? DEFAULT_CONFIG.trainCompact),
      twitchClientId: params.get("twitchClientId") || BOOT_CONFIG.twitchClientId || DEFAULT_CONFIG.twitchClientId,
      twitchAccessToken: params.get("twitchAccessToken") || BOOT_CONFIG.twitchAccessToken || DEFAULT_CONFIG.twitchAccessToken,
      showModerationControls: readBooleanParam(params, ["showModerationControls", "moderationControls", "dockModeration"], BOOT_CONFIG.showModerationControls ?? DEFAULT_CONFIG.showModerationControls),
      moderationDeleteAction: params.get("moderationDeleteAction") || BOOT_CONFIG.moderationDeleteAction || DEFAULT_CONFIG.moderationDeleteAction,
      moderationPinAction: params.get("moderationPinAction") || BOOT_CONFIG.moderationPinAction || DEFAULT_CONFIG.moderationPinAction,
      moderationTimeoutAction: params.get("moderationTimeoutAction") || BOOT_CONFIG.moderationTimeoutAction || DEFAULT_CONFIG.moderationTimeoutAction,
      moderationBanAction: params.get("moderationBanAction") || BOOT_CONFIG.moderationBanAction || DEFAULT_CONFIG.moderationBanAction,
      sendMessageAction: params.get("sendMessageAction") || BOOT_CONFIG.sendMessageAction || DEFAULT_CONFIG.sendMessageAction,
      moderationTimeoutSeconds: Number(params.get("moderationTimeoutSeconds") || BOOT_CONFIG.moderationTimeoutSeconds || DEFAULT_CONFIG.moderationTimeoutSeconds),
      broadcasterAvatarOverrides: {
        twitch: params.get("twitchBroadcasterAvatar") || (BOOT_CONFIG.broadcasterAvatarOverrides && BOOT_CONFIG.broadcasterAvatarOverrides.twitch) || "",
        youtube: params.get("youtubeBroadcasterAvatar") || (BOOT_CONFIG.broadcasterAvatarOverrides && BOOT_CONFIG.broadcasterAvatarOverrides.youtube) || "",
        kick: params.get("kickBroadcasterAvatar") || (BOOT_CONFIG.broadcasterAvatarOverrides && BOOT_CONFIG.broadcasterAvatarOverrides.kick) || "",
      },
      enabledPlatforms,
    };
  }

  function readBooleanParam(params, keys, fallbackValue) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const raw = String(params.get(key) || "").trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(raw)) {
        return true;
      }
      if (["0", "false", "no", "off"].includes(raw)) {
        return false;
      }
    }

    return fallbackValue;
  }

  function readOptionalPixelParam(params, keys, fallbackValue) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const raw = String(params.get(key) || "").trim();
      if (!raw) {
        continue;
      }

      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        return `${value}px`;
      }
    }

    return fallbackValue;
  }

  function parseOptionalPixelValue(value) {
    if (typeof value === "string") {
      const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
      if (match) {
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const numeric = Number(value.trim());
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    }
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return null;
  }

  function parseStoredTrainWidth(value, fallbackValue) {
    const parsed = parseOptionalPixelValue(value);
    return Number.isFinite(parsed) ? parsed : fallbackValue;
  }

  function parseStoredTrainScale(value, fallbackValue) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0.4, Math.min(2.5, parsed));
    }
    return fallbackValue;
  }

  function readNumberParam(params, keys, fallbackValue, options = {}) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const raw = Number(String(params.get(key) || "").trim());
      if (Number.isFinite(raw)) {
        const min = Number.isFinite(options.min) ? options.min : raw;
        const max = Number.isFinite(options.max) ? options.max : raw;
        return Math.max(min, Math.min(max, raw));
      }
    }

    return fallbackValue;
  }

  function readEnumParam(params, keys, allowedValues, fallbackValue) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const raw = String(params.get(key) || "").trim().toLowerCase();
      if (allowedValues.includes(raw)) {
        return raw;
      }
    }

    return fallbackValue;
  }

  function readColorParam(params, keys, fallbackValue) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const raw = String(params.get(key) || "").trim();
      if (!raw) {
        continue;
      }

      const normalized = raw.startsWith("#") ? raw : `#${raw}`;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
        return normalized;
      }
    }

    return fallbackValue;
  }

  function readOpacityParam(params, keys, fallbackValue) {
    for (const key of keys) {
      if (!params.has(key)) {
        continue;
      }

      const value = Number(String(params.get(key) || "").trim());
      if (Number.isFinite(value)) {
        return Math.max(0, Math.min(1, value));
      }
    }

    return fallbackValue;
  }

  function normalizeUserName(value) {
    return String(value || "").trim().replace(/^@+/, "").toLowerCase();
  }

  function loadLiteEffectsPreference() {
    try {
      const raw = window.localStorage.getItem(PERFORMANCE_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw);
      return !!(parsed && parsed.liteEffects);
    } catch (error) {
      return false;
    }
  }

  function persistLiteEffectsPreference() {
    try {
      window.localStorage.setItem(PERFORMANCE_SETTINGS_STORAGE_KEY, JSON.stringify({
        liteEffects: !!state.liteEffects,
      }));
    } catch (error) {
      // Ignore storage quota issues for perf preference.
    }
  }

  function loadOverlaySettings() {
    const defaults = {
      streamLiteEffects: loadLiteEffectsPreference(),
      dockLiteEffects: loadLiteEffectsPreference(),
      streamShowFollowAlerts: true,
      dockShowFollowAlerts: true,
      streamIgnoreBangCommands: !!config.ignoreBangCommands,
      dockIgnoreBangCommands: !!config.ignoreBangCommands,
      streamHideDeletedMessages: !!config.hideDeletedMessages,
      dockHideDeletedMessages: false,
      streamShowStatus: false,
      dockShowStatus: !!config.showStatus,
      ignoreUsersStream: [...config.ignoreUsers],
      ignoreUsersDock: [],
      trainPosition: config.trainPosition || "bottom-left",
      trainWidth: parseOptionalPixelValue(config.trainWidth),
      trainScale: Number.isFinite(config.trainScale) ? config.trainScale : 1,
      trainCompact: !!config.trainCompact,
    };

    try {
      const raw = window.localStorage.getItem(OVERLAY_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return defaults;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return defaults;
      }

      return {
        streamLiteEffects: parsed.streamLiteEffects !== undefined ? !!parsed.streamLiteEffects : !!parsed.liteEffects,
        dockLiteEffects: parsed.dockLiteEffects !== undefined ? !!parsed.dockLiteEffects : !!parsed.liteEffects,
        streamShowFollowAlerts: parsed.streamShowFollowAlerts !== undefined ? parsed.streamShowFollowAlerts !== false : parsed.showFollowAlerts !== false,
        dockShowFollowAlerts: parsed.dockShowFollowAlerts !== undefined ? parsed.dockShowFollowAlerts !== false : parsed.showFollowAlerts !== false,
        streamIgnoreBangCommands: parsed.streamIgnoreBangCommands !== undefined ? !!parsed.streamIgnoreBangCommands : !!parsed.ignoreBangCommands,
        dockIgnoreBangCommands: parsed.dockIgnoreBangCommands !== undefined ? !!parsed.dockIgnoreBangCommands : !!parsed.ignoreBangCommands,
        streamHideDeletedMessages: parsed.streamHideDeletedMessages !== undefined ? !!parsed.streamHideDeletedMessages : !!parsed.hideDeletedMessages,
        dockHideDeletedMessages: parsed.dockHideDeletedMessages !== undefined ? !!parsed.dockHideDeletedMessages : defaults.dockHideDeletedMessages,
        streamShowStatus: parsed.streamShowStatus !== undefined ? parsed.streamShowStatus !== false : defaults.streamShowStatus,
        dockShowStatus: parsed.dockShowStatus !== undefined ? parsed.dockShowStatus !== false : (parsed.showStatus !== undefined ? parsed.showStatus !== false : defaults.dockShowStatus),
        ignoreUsersStream: Array.isArray(parsed.ignoreUsersStream)
          ? parsed.ignoreUsersStream.map((value) => normalizeUserName(value)).filter(Boolean)
          : (Array.isArray(parsed.ignoreUsers)
            ? parsed.ignoreUsers.map((value) => normalizeUserName(value)).filter(Boolean)
            : defaults.ignoreUsersStream),
        ignoreUsersDock: Array.isArray(parsed.ignoreUsersDock)
          ? parsed.ignoreUsersDock.map((value) => normalizeUserName(value)).filter(Boolean)
          : defaults.ignoreUsersDock,
        trainPosition: ["top-left", "bottom-left", "bottom-center"].includes(String(parsed.trainPosition || "").trim().toLowerCase())
          ? String(parsed.trainPosition).trim().toLowerCase()
          : defaults.trainPosition,
        trainWidth: parseStoredTrainWidth(parsed.trainWidth, defaults.trainWidth),
        trainScale: parseStoredTrainScale(parsed.trainScale, defaults.trainScale),
        trainCompact: !!parsed.trainCompact,
      };
    } catch (error) {
      return defaults;
    }
  }

  function loadPlatformRuntimeState() {
    try {
      const raw = window.localStorage.getItem(PLATFORM_RUNTIME_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  async function fetchSharedPlatformRuntimeState() {
    if (window.location.protocol === "file:") {
      return null;
    }

    try {
      const response = await fetch(RUNTIME_STATE_API_PATH, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const payload = await response.json();
      return payload && typeof payload === "object" ? payload : null;
    } catch (error) {
      return null;
    }
  }

  function persistPlatformRuntimeState() {
    const next = {};
    try {
      for (const [key, platform] of Object.entries(state.platforms)) {
        next[key] = {
          connected: !!platform.connected,
          accountConnected: !!platform.accountConnected,
          chatConfirmed: !!platform.chatConfirmed,
          label: String(platform.label || ""),
          tone: String(platform.tone || ""),
          lastMessageAt: typeof platform.lastMessageAt === "number" ? platform.lastMessageAt : 0,
          viewerCount: null,
        };
      }
      window.localStorage.setItem(PLATFORM_RUNTIME_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      // Ignore storage failures; live state can still recover over the network.
    }

    if (!isLocalOnlyMode()) {
      fetch(RUNTIME_STATE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {
        // Local/browser runtime fallback still exists.
      });
    }
  }

  function applyPlatformRuntimeState(saved) {
    if (!saved || typeof saved !== "object") {
      return;
    }

    for (const [key, runtime] of Object.entries(saved)) {
      const platform = state.platforms[key];
      if (!platform || !runtime || typeof runtime !== "object") {
        continue;
      }

      if (typeof runtime.connected === "boolean") {
        platform.connected = runtime.connected;
      }
      if (typeof runtime.accountConnected === "boolean") {
        platform.accountConnected = runtime.accountConnected;
      }
      if (typeof runtime.chatConfirmed === "boolean") {
        platform.chatConfirmed = runtime.chatConfirmed;
      }
      if (typeof runtime.label === "string" && runtime.label) {
        platform.label = runtime.label;
      }
      if (typeof runtime.tone === "string" && runtime.tone) {
        platform.tone = runtime.tone;
      }
      if (typeof runtime.lastMessageAt === "number" && runtime.lastMessageAt > 0) {
        platform.lastMessageAt = runtime.lastMessageAt;
      }
    }
  }

  async function restorePlatformRuntimeState() {
    const shared = await fetchSharedPlatformRuntimeState();
    if (shared && typeof shared === "object" && Object.keys(shared).length) {
      applyPlatformRuntimeState(shared);
      return;
    }

    applyPlatformRuntimeState(loadPlatformRuntimeState());
  }

  async function fetchSharedOverlaySettings() {
    if (window.location.protocol === "file:") {
      return null;
    }

    try {
      const response = await fetch(SETTINGS_API_PATH, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        return null;
      }

      return {
        streamLiteEffects: payload.streamLiteEffects !== undefined ? !!payload.streamLiteEffects : !!payload.liteEffects,
        dockLiteEffects: payload.dockLiteEffects !== undefined ? !!payload.dockLiteEffects : !!payload.liteEffects,
        streamShowFollowAlerts: payload.streamShowFollowAlerts !== undefined ? payload.streamShowFollowAlerts !== false : payload.showFollowAlerts !== false,
        dockShowFollowAlerts: payload.dockShowFollowAlerts !== undefined ? payload.dockShowFollowAlerts !== false : payload.showFollowAlerts !== false,
        streamIgnoreBangCommands: payload.streamIgnoreBangCommands !== undefined ? !!payload.streamIgnoreBangCommands : !!payload.ignoreBangCommands,
        dockIgnoreBangCommands: payload.dockIgnoreBangCommands !== undefined ? !!payload.dockIgnoreBangCommands : !!payload.ignoreBangCommands,
        streamHideDeletedMessages: payload.streamHideDeletedMessages !== undefined ? !!payload.streamHideDeletedMessages : !!payload.hideDeletedMessages,
        dockHideDeletedMessages: payload.dockHideDeletedMessages !== undefined ? !!payload.dockHideDeletedMessages : false,
        streamShowStatus: payload.streamShowStatus !== undefined ? payload.streamShowStatus !== false : false,
        dockShowStatus: payload.dockShowStatus !== undefined ? payload.dockShowStatus !== false : (payload.showStatus !== false),
        ignoreUsersStream: Array.isArray(payload.ignoreUsersStream)
          ? payload.ignoreUsersStream.map((value) => normalizeUserName(value)).filter(Boolean)
          : [],
        ignoreUsersDock: Array.isArray(payload.ignoreUsersDock)
          ? payload.ignoreUsersDock.map((value) => normalizeUserName(value)).filter(Boolean)
          : [],
        trainPosition: ["top-left", "bottom-left", "bottom-center"].includes(String(payload.trainPosition || "").trim().toLowerCase())
          ? String(payload.trainPosition).trim().toLowerCase()
          : "bottom-left",
        trainWidth: parseStoredTrainWidth(payload.trainWidth, parseOptionalPixelValue(config.trainWidth)),
        trainScale: parseStoredTrainScale(payload.trainScale, Number.isFinite(config.trainScale) ? config.trainScale : 1),
        trainCompact: !!payload.trainCompact,
      };
    } catch (error) {
      return null;
    }
  }

  function getOverlaySettingsSignature(settings) {
    if (!settings || typeof settings !== "object") {
      return "";
    }

    return JSON.stringify({
      streamLiteEffects: !!settings.streamLiteEffects,
      dockLiteEffects: !!settings.dockLiteEffects,
      streamShowFollowAlerts: !!settings.streamShowFollowAlerts,
      dockShowFollowAlerts: !!settings.dockShowFollowAlerts,
      streamIgnoreBangCommands: !!settings.streamIgnoreBangCommands,
      dockIgnoreBangCommands: !!settings.dockIgnoreBangCommands,
      streamHideDeletedMessages: !!settings.streamHideDeletedMessages,
      dockHideDeletedMessages: !!settings.dockHideDeletedMessages,
      streamShowStatus: !!settings.streamShowStatus,
      dockShowStatus: !!settings.dockShowStatus,
      ignoreUsersStream: Array.isArray(settings.ignoreUsersStream) ? settings.ignoreUsersStream : [],
      ignoreUsersDock: Array.isArray(settings.ignoreUsersDock) ? settings.ignoreUsersDock : [],
      trainPosition: settings.trainPosition || "bottom-left",
      trainWidth: Number.isFinite(settings.trainWidth) ? settings.trainWidth : null,
      trainScale: Number.isFinite(settings.trainScale) ? settings.trainScale : 1,
      trainCompact: !!settings.trainCompact,
    });
  }

  function persistOverlaySettings() {
    try {
      window.localStorage.setItem(OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify({
        streamLiteEffects: !!state.overlaySettings.streamLiteEffects,
        dockLiteEffects: !!state.overlaySettings.dockLiteEffects,
        streamShowFollowAlerts: !!state.overlaySettings.streamShowFollowAlerts,
        dockShowFollowAlerts: !!state.overlaySettings.dockShowFollowAlerts,
        streamIgnoreBangCommands: !!state.overlaySettings.streamIgnoreBangCommands,
        dockIgnoreBangCommands: !!state.overlaySettings.dockIgnoreBangCommands,
        streamHideDeletedMessages: !!state.overlaySettings.streamHideDeletedMessages,
        dockHideDeletedMessages: !!state.overlaySettings.dockHideDeletedMessages,
        streamShowStatus: !!state.overlaySettings.streamShowStatus,
        dockShowStatus: !!state.overlaySettings.dockShowStatus,
        ignoreUsersStream: Array.isArray(state.overlaySettings.ignoreUsersStream) ? state.overlaySettings.ignoreUsersStream : [],
        ignoreUsersDock: Array.isArray(state.overlaySettings.ignoreUsersDock) ? state.overlaySettings.ignoreUsersDock : [],
        trainPosition: state.overlaySettings.trainPosition || "bottom-left",
        trainWidth: Number.isFinite(state.overlaySettings.trainWidth) ? state.overlaySettings.trainWidth : null,
        trainScale: Number.isFinite(state.overlaySettings.trainScale) ? state.overlaySettings.trainScale : 1,
        trainCompact: !!state.overlaySettings.trainCompact,
      }));
    } catch (error) {
      // Ignore storage quota issues for settings.
    }
  }

  function getIgnoreUsersSetting() {
    const values = config.showModerationControls
      ? state.overlaySettings.ignoreUsersDock
      : state.overlaySettings.ignoreUsersStream;
    return Array.isArray(values) ? values : [];
  }

  function shouldShowStatusStrip() {
    return config.showModerationControls
      ? !!state.overlaySettings.dockShowStatus
      : !!state.overlaySettings.streamShowStatus;
  }

  function shouldHideDeletedMessages() {
    return config.showModerationControls
      ? !!state.overlaySettings.dockHideDeletedMessages
      : !!state.overlaySettings.streamHideDeletedMessages;
  }

  function shouldIgnoreBangCommands() {
    return config.showModerationControls
      ? !!state.overlaySettings.dockIgnoreBangCommands
      : !!state.overlaySettings.streamIgnoreBangCommands;
  }

  function shouldShowFollowAlerts() {
    return config.showModerationControls
      ? !!state.overlaySettings.dockShowFollowAlerts
      : !!state.overlaySettings.streamShowFollowAlerts;
  }

  function applyPerformanceMode() {
    state.liteEffects = config.showModerationControls
      ? !!state.overlaySettings.dockLiteEffects
      : !!state.overlaySettings.streamLiteEffects;
    document.body.classList.toggle("performance-lite", !!state.liteEffects);
  }

  function renderPerformanceControls() {
    if (!ui.performanceControls) {
      return;
    }

    const showSettingsButton = !!config.showModerationControls;
    ui.performanceControls.classList.toggle("hidden", !showSettingsButton);
    if (ui.overlaySettingsButton) {
      ui.overlaySettingsButton.classList.toggle("hidden", !showSettingsButton);
      ui.overlaySettingsButton.setAttribute("aria-expanded", state.settingsDialogOpen ? "true" : "false");
    }
  }

  function toggleLiteEffects() {
    if (config.showModerationControls) {
      state.overlaySettings.dockLiteEffects = !state.overlaySettings.dockLiteEffects;
    } else {
      state.overlaySettings.streamLiteEffects = !state.overlaySettings.streamLiteEffects;
    }
    persistLiteEffectsPreference();
    persistOverlaySettings();
    applyPerformanceMode();
    renderPerformanceControls();
    renderFeed();
  }

  function registerCardCleanup(card, cleanup) {
    if (!card || typeof cleanup !== "function") {
      return;
    }

    const existing = state.cardCleanup.get(card);
    if (!existing) {
      state.cardCleanup.set(card, cleanup);
      return;
    }

    state.cardCleanup.set(card, () => {
      try {
        existing();
      } finally {
        cleanup();
      }
    });
  }

  function cleanupCardNode(card) {
    if (!card) {
      return;
    }

    const cleanup = state.cardCleanup.get(card);
    state.cardCleanup.delete(card);
    if (typeof cleanup === "function") {
      cleanup();
    }
  }

  function cleanupFeedDom() {
    if (state.renderFlushHandle) {
      window.cancelAnimationFrame(state.renderFlushHandle);
      state.renderFlushHandle = 0;
    }
    state.pendingRenderQueue = [];

    if (!ui.chatFeed) {
      return;
    }

    const cards = Array.from(ui.chatFeed.children);
    for (const card of cards) {
      cleanupCardNode(card);
    }
    ui.chatFeed.innerHTML = "";
  }

  function passesFeedClearCutoff(item) {
    if (!state.feedClearedBefore) {
      return true;
    }

    const timestamp = Number(item && item.timestamp);
    return Number.isFinite(timestamp) && timestamp >= state.feedClearedBefore;
  }

  function getRenderableFeedItems() {
    const visibleItems = [];
    for (let index = state.feedItems.length - 1; index >= 0; index -= 1) {
      const item = state.feedItems[index];
      if (!passesFeedClearCutoff(item) || !shouldDisplayMessage(item)) {
        continue;
      }
      visibleItems.push(item);
      if (visibleItems.length >= renderedMessageLimit) {
        break;
      }
    }
    visibleItems.reverse();
    return visibleItems;
  }

  function trimRenderedFeedDom() {
    if (!ui.chatFeed) {
      return;
    }

    while (ui.chatFeed.children.length > renderedMessageLimit) {
      const oldestCard = ui.chatFeed.firstElementChild;
      if (!oldestCard) {
        break;
      }
      cleanupCardNode(oldestCard);
      oldestCard.remove();
    }
  }

  function flushPendingRenderQueue() {
    state.renderFlushHandle = 0;
    if (!ui.chatFeed || !state.pendingRenderQueue.length) {
      state.pendingRenderQueue = [];
    state.scrollAfterFlush = false;
    return;
  }

    const queue = state.pendingRenderQueue.splice(0, state.pendingRenderQueue.length);
    const fragment = document.createDocumentFragment();
    const mountedCards = [];

    for (const entry of queue) {
      if (!entry || !passesFeedClearCutoff(entry.item) || !shouldDisplayMessage(entry.item)) {
        continue;
      }
      const built = buildMessageFragment(entry.item, entry.animate);
      if (!built) {
        continue;
      }
      const card = built.querySelector(".message-card");
      fragment.appendChild(built);
      if (card) {
        mountedCards.push({ card, item: entry.item });
      }
    }

    if (!mountedCards.length) {
      state.scrollAfterFlush = false;
      return;
    }

    ui.chatFeed.appendChild(fragment);
    for (const entry of mountedCards) {
      initializeDeferredEffects(entry.card, entry.item);
    }
    trimRenderedFeedDom();
    if (state.scrollAfterFlush && !state.scrollPaused) {
      state.scrollAfterFlush = false;
      scheduleScrollToLatestBurst();
    } else {
      state.scrollAfterFlush = false;
    }
  }

  function enqueueFeedRender(item, animate = true) {
    state.pendingRenderQueue.push({ item, animate });
    if (!state.renderFlushHandle) {
      state.renderFlushHandle = window.requestAnimationFrame(flushPendingRenderQueue);
    }
  }

  function clearRenderedFeed() {
    state.feedClearedBefore = Date.now();
    state.feedItems = [];
    state.pausedNewCount = 0;
    cleanupFeedDom();
    updatePauseBanner();
    persistFeed();
  }

  function openSettingsDialog() {
    if (!config.showModerationControls) {
      return;
    }
    state.settingsDialogOpen = true;
    state.settingsActiveTab = state.settingsActiveTab || "stream";
    syncSettingsForm();
    renderSettingsTabs();
    renderPerformanceControls();
    if (ui.overlaySettingsBackdrop) {
      ui.overlaySettingsBackdrop.classList.remove("hidden");
      ui.overlaySettingsBackdrop.setAttribute("aria-hidden", "false");
    }
  }

  function closeSettingsDialog() {
    state.settingsDialogOpen = false;
    renderPerformanceControls();
    if (ui.overlaySettingsBackdrop) {
      ui.overlaySettingsBackdrop.classList.add("hidden");
      ui.overlaySettingsBackdrop.setAttribute("aria-hidden", "true");
    }
  }

  function syncSettingsForm() {
    if (!config.showModerationControls) {
      return;
    }
    if (ui.settingsStreamLiteEffects) {
      ui.settingsStreamLiteEffects.checked = !!state.overlaySettings.streamLiteEffects;
    }
    if (ui.settingsStreamFollowAlerts) {
      ui.settingsStreamFollowAlerts.checked = !!state.overlaySettings.streamShowFollowAlerts;
    }
    if (ui.settingsStreamIgnoreBang) {
      ui.settingsStreamIgnoreBang.checked = !!state.overlaySettings.streamIgnoreBangCommands;
    }
    if (ui.settingsStreamHideDeleted) {
      ui.settingsStreamHideDeleted.checked = !!state.overlaySettings.streamHideDeletedMessages;
    }
    if (ui.settingsStreamShowStatus) {
      ui.settingsStreamShowStatus.checked = !!state.overlaySettings.streamShowStatus;
    }
    if (ui.settingsDockLiteEffects) {
      ui.settingsDockLiteEffects.checked = !!state.overlaySettings.dockLiteEffects;
    }
    if (ui.settingsDockFollowAlerts) {
      ui.settingsDockFollowAlerts.checked = !!state.overlaySettings.dockShowFollowAlerts;
    }
    if (ui.settingsDockIgnoreBang) {
      ui.settingsDockIgnoreBang.checked = !!state.overlaySettings.dockIgnoreBangCommands;
    }
    if (ui.settingsDockHideDeleted) {
      ui.settingsDockHideDeleted.checked = !!state.overlaySettings.dockHideDeletedMessages;
    }
    if (ui.settingsDockShowStatus) {
      ui.settingsDockShowStatus.checked = !!state.overlaySettings.dockShowStatus;
    }
    if (ui.settingsIgnoreUsersStream) {
      ui.settingsIgnoreUsersStream.value = Array.isArray(state.overlaySettings.ignoreUsersStream)
        ? state.overlaySettings.ignoreUsersStream.join(", ")
        : "";
    }
    if (ui.settingsIgnoreUsersDock) {
      ui.settingsIgnoreUsersDock.value = Array.isArray(state.overlaySettings.ignoreUsersDock)
        ? state.overlaySettings.ignoreUsersDock.join(", ")
        : "";
    }
    if (ui.settingsTrainPosition) {
      ui.settingsTrainPosition.value = state.overlaySettings.trainPosition || "bottom-left";
    }
    if (ui.settingsTrainWidth) {
      ui.settingsTrainWidth.value = Number.isFinite(state.overlaySettings.trainWidth) ? String(state.overlaySettings.trainWidth) : "";
    }
    if (ui.settingsTrainScale) {
      ui.settingsTrainScale.value = Number.isFinite(state.overlaySettings.trainScale) ? String(state.overlaySettings.trainScale) : "1";
    }
    if (ui.settingsTrainCompact) {
      ui.settingsTrainCompact.checked = !!state.overlaySettings.trainCompact;
    }
  }

  function renderSettingsTabs() {
    const activeTab = state.settingsActiveTab || "stream";
    if (Array.isArray(ui.settingsTabs)) {
      for (const tab of ui.settingsTabs) {
        const isActive = tab && tab.dataset && tab.dataset.settingsTab === activeTab;
        tab.classList.toggle("is-active", !!isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      }
    }
    if (Array.isArray(ui.settingsPanels)) {
      for (const panel of ui.settingsPanels) {
        const isActive = panel && panel.dataset && panel.dataset.settingsPanel === activeTab;
        panel.classList.toggle("hidden", !isActive);
      }
    }
  }

  function openSettingsTab(tabName) {
    const nextTab = ["stream", "dock", "train", "testing"].includes(String(tabName || ""))
      ? String(tabName)
      : "stream";
    state.settingsActiveTab = nextTab;
    renderSettingsTabs();
  }

  function applyOverlaySettingsState(options = {}) {
    applyPerformanceMode();
    applyConfigStyles();
    renderPerformanceControls();
    if (!config.showModerationControls) {
      closeSettingsDialog();
    }
    if (shouldHideDeletedMessages()) {
      loadRemovedMessageIds();
    } else {
      state.removedMessageIds = new Set();
    }
    renderFeed();
    if (!options.skipPersist) {
      persistLiteEffectsPreference();
      persistOverlaySettings();
    }
  }

  function saveSettingsDialog() {
    if (!config.showModerationControls) {
      closeSettingsDialog();
      return;
    }
    const ignoreUsersStream = ui.settingsIgnoreUsersStream
      ? String(ui.settingsIgnoreUsersStream.value || "")
        .split(",")
        .map((value) => normalizeUserName(value))
        .filter(Boolean)
      : [];
    const ignoreUsersDock = ui.settingsIgnoreUsersDock
      ? String(ui.settingsIgnoreUsersDock.value || "")
        .split(",")
        .map((value) => normalizeUserName(value))
        .filter(Boolean)
      : [];

    state.overlaySettings = {
      streamLiteEffects: !!(ui.settingsStreamLiteEffects && ui.settingsStreamLiteEffects.checked),
      dockLiteEffects: !!(ui.settingsDockLiteEffects && ui.settingsDockLiteEffects.checked),
      streamShowFollowAlerts: !!(ui.settingsStreamFollowAlerts && ui.settingsStreamFollowAlerts.checked),
      dockShowFollowAlerts: !!(ui.settingsDockFollowAlerts && ui.settingsDockFollowAlerts.checked),
      streamIgnoreBangCommands: !!(ui.settingsStreamIgnoreBang && ui.settingsStreamIgnoreBang.checked),
      dockIgnoreBangCommands: !!(ui.settingsDockIgnoreBang && ui.settingsDockIgnoreBang.checked),
      streamHideDeletedMessages: !!(ui.settingsStreamHideDeleted && ui.settingsStreamHideDeleted.checked),
      dockHideDeletedMessages: !!(ui.settingsDockHideDeleted && ui.settingsDockHideDeleted.checked),
      streamShowStatus: !!(ui.settingsStreamShowStatus && ui.settingsStreamShowStatus.checked),
      dockShowStatus: !!(ui.settingsDockShowStatus && ui.settingsDockShowStatus.checked),
      ignoreUsersStream,
      ignoreUsersDock,
      trainPosition: ui.settingsTrainPosition ? String(ui.settingsTrainPosition.value || "bottom-left").trim().toLowerCase() : "bottom-left",
      trainWidth: ui.settingsTrainWidth ? parseStoredTrainWidth(ui.settingsTrainWidth.value, parseOptionalPixelValue(config.trainWidth)) : parseOptionalPixelValue(config.trainWidth),
      trainScale: ui.settingsTrainScale ? parseStoredTrainScale(ui.settingsTrainScale.value, Number.isFinite(config.trainScale) ? config.trainScale : 1) : (Number.isFinite(config.trainScale) ? config.trainScale : 1),
      trainCompact: !!(ui.settingsTrainCompact && ui.settingsTrainCompact.checked),
    };

    applyOverlaySettingsState();
    broadcastOverlaySettingsRuntime();
    if (window.location.protocol !== "file:") {
      fetch(SETTINGS_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.overlaySettings),
      }).catch(() => {
        // Local fallback still applies for this dock session.
      });
    }
    closeSettingsDialog();
    showToast("Overlay settings updated.", "ok");
  }

  function applyConfigStyles() {
    const root = document.documentElement;
    const trainWidth = Number.isFinite(state.overlaySettings.trainWidth) ? `${state.overlaySettings.trainWidth}px` : config.trainWidth;
    const trainScale = Number.isFinite(state.overlaySettings.trainScale) ? state.overlaySettings.trainScale : (Number.isFinite(config.trainScale) ? config.trainScale : 1);
    const trainPosition = state.overlaySettings.trainPosition || config.trainPosition || "bottom-left";
    const trainCompact = state.overlaySettings.trainCompact !== undefined ? !!state.overlaySettings.trainCompact : !!config.trainCompact;
    setOptionalCssVar(root, "--message-font-size", config.fontSize);
    setOptionalCssVar(root, "--username-font-size", config.usernameFontSize);
    setOptionalCssVar(root, "--supporter-name-font-size", config.supporterNameFontSize);
    setOptionalCssVar(root, "--member-name-font-size", config.memberNameFontSize);
    setOptionalCssVar(root, "--time-font-size", config.timeFontSize);
    setOptionalCssVar(root, "--train-width", trainWidth);
    root.style.setProperty("--train-scale", String(trainScale));
    root.style.setProperty("--overlay-bg", toRgba(config.backgroundColor, config.backgroundOpacity));
    if (ui.statusItems) {
      ui.statusItems.classList.toggle("hidden", !shouldShowStatusStrip());
    }
    document.body.classList.toggle("dock-controls-enabled", !!config.showModerationControls);
    document.body.classList.toggle("train-only", !!config.trainOnly);
    document.body.classList.toggle("train-compact", !!trainCompact);
    document.body.classList.remove("train-pos-top-left", "train-pos-bottom-left", "train-pos-bottom-center");
    document.body.classList.add(`train-pos-${trainPosition}`);
  }

  function setOptionalCssVar(root, name, value) {
    if (!root) {
      return;
    }

    if (value) {
      root.style.setProperty(name, value);
    } else {
      root.style.removeProperty(name);
    }
  }

  function isLocalOnlyMode() {
    return !!config.localOnly || window.location.protocol === "file:";
  }

  function buildPlatformState() {
    const platforms = {
      streamerbot: makePlatformState(),
    };

    for (const key of config.enabledPlatforms) {
      platforms[key] = makePlatformState();
    }

    return platforms;
  }

  function makePlatformState() {
    return {
      connected: false,
      accountConnected: false,
      chatConfirmed: false,
      label: "Disconnected",
      tone: "disconnected",
      lastMessageAt: null,
      viewerCount: null,
    };
  }

  function connect() {
    const scheme = config.secure ? "wss" : "ws";
    const url = `${scheme}://${config.host}:${config.port}/`;

    clearReconnectTimer();

    state.socket = new WebSocket(url);
    state.socket.addEventListener("open", onSocketOpen);
    state.socket.addEventListener("close", onSocketClose);
    state.socket.addEventListener("error", onSocketError);
    state.socket.addEventListener("message", onSocketMessage);
  }

  function onSocketOpen() {
    state.connectedAt = Date.now();
    state.lastSocketActivityAt = state.connectedAt;
    state.lastSocketError = null;
    state.setupComplete = false;
    setSocketState("checking", "Checking");
    renderStatus();
  }

  function onSocketClose() {
    state.connectedAt = null;
    state.lastSocketActivityAt = 0;
    state.setupComplete = false;
    state.setupInFlight = false;
    rejectAllPending("Socket closed before the request completed.");
    setSocketState("disconnected", "Disconnected");
    showToast("Streamer.bot disconnected.", "danger");
    renderStatus();
    scheduleReconnect();
  }

  function onSocketError() {
    state.lastSocketError = "WebSocket connection failed.";
    state.setupInFlight = false;
    setSocketState("disconnected", "Error");
    renderStatus();
  }

  function onSocketMessage(event) {
    let payload;

    state.lastSocketActivityAt = Date.now();

    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (payload.request === "Hello") {
      handleHello(payload);
      return;
    }

    if (payload.id && state.pendingRequests.has(payload.id) && Object.prototype.hasOwnProperty.call(payload, "status")) {
      const handlers = state.pendingRequests.get(payload.id);
      state.pendingRequests.delete(payload.id);

      if (payload.status === "ok") {
        handlers.resolve(payload);
      } else {
        handlers.reject(new Error(payload.error || payload.message || "Streamer.bot request failed."));
      }
      return;
    }

    if (!payload.event || !payload.event.source || !payload.event.type) {
      return;
    }

    state.lastLiveEventAt = Date.now();
    handleEvent(payload);
  }

  async function handleHello(payload) {
    try {
      if (payload.authentication && config.password) {
        await authenticate(payload.authentication);
        showToast("Authenticated with Streamer.bot.", "ok");
      }

      await finishSetup();
    } catch (error) {
      state.lastSocketError = error.message;
      setSocketState("disconnected", "Error");
      showToast(`Handshake failed: ${error.message}`, "danger");
      renderStatus();
    }
  }

  async function finishSetup() {
    if (state.setupInFlight) {
      return;
    }

    state.setupInFlight = true;
    try {
      await subscribeToEvents();
      await syncBroadcasterStatus();
      state.setupComplete = true;
      setSocketState("connected", "Connected");
      showToast("Streamer.bot connected.", "ok");
      renderStatus();
    } finally {
      state.setupInFlight = false;
    }
  }

  async function authenticate(authenticationInfo) {
    const encoder = new TextEncoder();
    const salt = authenticationInfo.salt || "";
    const challenge = authenticationInfo.challenge || "";

    const secretHash = await crypto.subtle.digest("SHA-256", encoder.encode(`${config.password}${salt}`));
    const secret = arrayBufferToBase64(secretHash);
    const authHash = await crypto.subtle.digest("SHA-256", encoder.encode(`${secret}${challenge}`));
    const authentication = arrayBufferToBase64(authHash);

    await sendRequest("Authenticate", { authentication });
  }

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);

    for (let index = 0; index < bytes.byteLength; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary);
  }

  function scheduleReconnect() {
    if (state.reconnectTimer || !state.internetOnline) {
      return;
    }

    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      connect();
    }, config.reconnectDelayMs);
  }

  function clearReconnectTimer() {
    if (!state.reconnectTimer) {
      return;
    }

    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  function rejectAllPending(reason) {
    for (const handlers of state.pendingRequests.values()) {
      handlers.reject(new Error(reason));
    }
    state.pendingRequests.clear();
  }

  function sendRequest(request, extra, options) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Socket is not open."));
    }

    const id = `req-${Date.now()}-${++state.requestCounter}`;
    const payload = { request, id, ...(extra || {}) };
    const timeoutMs = Number(options && options.timeoutMs) || config.requestTimeoutMs;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        state.pendingRequests.delete(id);
        reject(new Error(`${request} timed out.`));
      }, timeoutMs);

      state.pendingRequests.set(id, {
        resolve: (response) => {
          window.clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
      });
      state.socket.send(JSON.stringify(payload));
    });
  }

  async function subscribeToEvents() {
    const events = {};
    let supportedEvents = null;

    try {
      const response = await sendRequest("GetEvents");
      supportedEvents = response && response.events && typeof response.events === "object"
        ? response.events
        : null;
    } catch (error) {
      supportedEvents = null;
    }

    for (const eventSource of Object.keys(EVENT_SUBSCRIPTIONS)) {
      const requestedEvents = EVENT_SUBSCRIPTIONS[eventSource];
      if (!Array.isArray(requestedEvents) || !requestedEvents.length) {
        continue;
      }

      if (!supportedEvents) {
        events[eventSource] = requestedEvents;
        continue;
      }

      const supportedEntries = Object.entries(supportedEvents).find(([key]) => String(key || "").toLowerCase() === String(eventSource || "").toLowerCase());
      const supportedList = Array.isArray(supportedEntries && supportedEntries[1]) ? supportedEntries[1] : [];
      const supportedSet = new Set(supportedList.map((value) => String(value || "").toLowerCase()));
      const filtered = requestedEvents.filter((eventName) => supportedSet.has(String(eventName || "").toLowerCase()));
      if (filtered.length) {
        events[eventSource] = filtered;
      }
    }

    await sendRequest("Subscribe", { events });
  }

  async function syncBroadcasterStatus() {
    const response = await sendRequest("GetBroadcaster");
    const connected = new Set((response.connected || []).map((value) => String(value).toLowerCase()));
    state.broadcasters = response.platforms || {};

    for (const key of Object.keys(state.platforms)) {
      if (key === "streamerbot") {
        continue;
      }

      updatePlatformConnection(key, connected.has(key), true);
    }

    // Keep StreamElements honest here; it should turn green when we actually
    // receive a StreamElements event instead of assuming success on startup.
  }

  function handleEvent(payload) {
    const source = String(payload.event.source || "").toLowerCase();
    const type = String(payload.event.type || "");
    const data = payload.data || {};

    maybeUpdateViewerCount(source, type, data);

    if (config.hideDeletedMessages) {
      if (source === "twitch" && type === "ChatMessageDeleted") {
        handleDeletedMessage(source, data);
        renderStatus();
        return;
      }
      if (source === "youtube" && type === "MessageDeleted") {
        handleDeletedMessage(source, data);
        renderStatus();
        return;
      }
    }

    switch (`${source}.${type}`) {
      case "twitch.BroadcasterChatConnected":
      case "kick.BroadcasterChatConnected":
      case "youtube.BroadcastMonitoringStarted":
        updatePlatformConnection(source, true);
        if (state.platforms[source]) {
          state.platforms[source].chatConfirmed = true;
        }
        showToast(`${PLATFORM_META[source].label} connected.`, "ok");
        break;
      case "twitch.BroadcasterChatDisconnected":
      case "kick.BroadcasterChatDisconnected":
      case "youtube.BroadcastMonitoringEnded":
        updatePlatformConnection(source, false);
        showToast(`${PLATFORM_META[source].label} disconnected.`, "danger");
        break;
      case "streamlabs.Connected":
      case "streamlabs.Authenticated":
        updatePlatformConnection(source, true);
        if (state.platforms[source]) {
          state.platforms[source].chatConfirmed = true;
          state.platforms[source].lastMessageAt = Date.now();
        }
        showToast("Streamlabs connected.", "ok");
        break;
      case "streamlabs.Disconnected":
        updatePlatformConnection(source, false);
        showToast("Streamlabs disconnected.", "danger");
        break;
      case "streamelements.Connected":
      case "streamelements.Authenticated":
        updatePlatformConnection(source, true);
        if (state.platforms[source]) {
          state.platforms[source].chatConfirmed = true;
          state.platforms[source].lastMessageAt = Date.now();
        }
        showToast("StreamElements connected.", "ok");
        break;
      case "streamelements.Disconnected":
        updatePlatformConnection(source, false);
        showToast("StreamElements disconnected.", "danger");
        break;
      default:
        break;
    }

    if (source === "youtube" && state.platforms.youtube && isYouTubeChatEvidence(type)) {
      state.platforms.youtube.accountConnected = true;
      state.platforms.youtube.connected = true;
      state.platforms.youtube.chatConfirmed = true;
    }

    const message = normalizeMessage(source, type, data);
    if (!message) {
      renderStatus();
      return;
    }

    if (state.platforms[source]) {
      state.platforms[source].connected = true;
      state.platforms[source].accountConnected = true;
      if (source !== "youtube" || isYouTubeChatEvidence(type)) {
        state.platforms[source].chatConfirmed = true;
      }
      state.platforms[source].lastMessageAt = Date.now();
      persistPlatformRuntimeState();
    }

    pushChatMessage(message);
    processSupportTrainEvent(source, type, data, message);
    renderStatus();
  }

  function handleDeletedMessage(platformKey, data) {
    const messageId = extractMessageId(platformKey, data);
    if (!messageId) {
      return;
    }

    markMessageRemoved(messageId, { platform: platformKey });
  }

  function removeMessageFromFeed(messageId) {
    if (!messageId) {
      return false;
    }

    const nextFeedItems = state.feedItems.filter((item) => item.messageId !== messageId);
    if (nextFeedItems.length === state.feedItems.length) {
      return false;
    }

    state.feedItems = nextFeedItems;
    syncLocalBackup();
    renderFeed();
    if (!state.scrollPaused) {
      scheduleScrollToLatestBurst();
    }
    return true;
  }

  function markMessageRemoved(messageId, options = {}) {
    if (!messageId) {
      return false;
    }

    state.removedMessageIds.add(messageId);
    persistRemovedMessageIds();
    if (!options.skipHistorySync) {
      persistRemovedMessageToHistory(messageId, options.platform || "");
    }
    return removeMessageFromFeed(messageId);
  }

  function persistRemovedMessageToHistory(messageId, platformHint = "") {
    if (!messageId || isLocalOnlyMode()) {
      return;
    }

    const platform = platformHint || findPlatformForMessageId(messageId);
    if (!platform) {
      return;
    }

    fetch(HISTORY_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "remove",
        platform,
        messageId,
      }),
    }).catch(() => {
      // The local removed cache still prevents redraws in this session.
    });
  }

  function findPlatformForMessageId(messageId) {
    if (!messageId) {
      return "";
    }

    for (let index = state.feedItems.length - 1; index >= 0; index -= 1) {
      const item = state.feedItems[index];
      if (item && item.messageId === messageId && item.platform) {
        return item.platform;
      }
    }

    return "";
  }

  function maybeUpdateViewerCount(platformKey, eventType, data) {
    const platform = state.platforms[platformKey];
    if (!platform) {
      return;
    }

    const nextViewerCount = extractViewerCount(platformKey, eventType, data);
    if (platformKey === "kick" && (String(eventType || "").toLowerCase().includes("viewer") || nextViewerCount != null)) {
      debugKickViewerPayload(eventType, data, nextViewerCount);
    }
    if (nextViewerCount == null) {
      return;
    }

    platform.viewerCount = nextViewerCount;
    persistPlatformRuntimeState();
  }

  function extractViewerCount(platformKey, eventType, data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    if ((platformKey === "twitch" || platformKey === "kick") && eventType === "ViewerCountUpdate") {
      return pickViewerCount(data, [
        "viewerCount",
        "viewers",
        "count",
        "currentViewers",
      ]);
    }

    if (platformKey === "kick" && eventType === "PresentViewers") {
      const countFromFields = pickViewerCount(data, [
        "viewerCount",
        "presentViewers",
        "count",
      ]);
      if (countFromFields != null) {
        return countFromFields;
      }

      const users = getValueByPath(data, "users");
      if (Array.isArray(users)) {
        return users.length;
      }
    }

    if (platformKey === "youtube" && eventType === "StatisticsUpdated") {
      return pickViewerCount(data, [
        "viewerCount",
        "concurrentViewers",
        "concurrentViewerCount",
        "viewCount",
        "statistics.viewerCount",
        "statistics.concurrentViewers",
      ]);
    }

    if (platformKey === "youtube" && eventType === "PresentViewers") {
      const countFromFields = pickViewerCount(data, [
        "viewerCount",
        "presentViewers",
        "count",
      ]);
      if (countFromFields != null) {
        return countFromFields;
      }

      const users = getValueByPath(data, "users");
      if (Array.isArray(users)) {
        return users.length;
      }
    }

    return null;
  }

  function pickViewerCount(data, paths) {
    for (const path of paths) {
      const value = getValueByPath(data, path);
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
      }
      if (typeof value === "string") {
        const normalized = value.replaceAll(",", "").trim();
        if (!normalized) {
          continue;
        }
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.round(parsed));
        }
      }
    }

    return null;
  }

  function createSupportTrainState() {
    return {
      active: false,
      totalPoints: 0,
      level: 0,
      dominantPlatform: "kick",
      platformPoints: {},
      eventCount: 0,
      lastContributor: "",
      lastContributionLabel: "",
      expiresAt: 0,
      endTimer: 0,
      lastSyntheticId: "",
    };
  }

  function buildSupportTrainSnapshot(train) {
    const source = train || createSupportTrainState();
    const snapshot = {
      active: !!source.active && Number(source.expiresAt) > Date.now(),
      totalPoints: Number.isFinite(source.totalPoints) ? Math.max(0, Math.round(source.totalPoints)) : 0,
      level: Number.isFinite(source.level) ? Math.max(0, Math.round(source.level)) : 0,
      dominantPlatform: typeof source.dominantPlatform === "string" && source.dominantPlatform
        ? source.dominantPlatform
        : "kick",
      platformPoints: {},
      eventCount: Number.isFinite(source.eventCount) ? Math.max(0, Math.round(source.eventCount)) : 0,
      lastContributor: typeof source.lastContributor === "string" ? source.lastContributor : "",
      lastContributionLabel: typeof source.lastContributionLabel === "string" ? source.lastContributionLabel : "",
      expiresAt: Number.isFinite(source.expiresAt) ? Math.max(0, Math.round(source.expiresAt)) : 0,
    };

    if (source.platformPoints && typeof source.platformPoints === "object") {
      for (const [key, value] of Object.entries(source.platformPoints)) {
        if (!key) {
          continue;
        }
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
          snapshot.platformPoints[key] = Math.round(numericValue);
        }
      }
    }

    if (!snapshot.active) {
      snapshot.level = 0;
      snapshot.totalPoints = 0;
      snapshot.eventCount = 0;
      snapshot.platformPoints = {};
      snapshot.lastContributor = "";
      snapshot.lastContributionLabel = "";
      snapshot.expiresAt = 0;
    }

    return snapshot;
  }

  function persistSupportTrain() {
    const snapshot = buildSupportTrainSnapshot(state.supportTrain);
    try {
      window.localStorage.setItem(SUPPORT_TRAIN_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      // Ignore local storage quota issues; train HUD still works in the current page.
    }
    if (window.location.protocol !== "file:") {
      fetch(TRAIN_STATUS_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: !!snapshot.active,
          level: snapshot.level,
          platform: snapshot.dominantPlatform,
          points: snapshot.totalPoints,
          eventCount: snapshot.eventCount,
          lastContributor: snapshot.lastContributor,
          lastContributionLabel: snapshot.lastContributionLabel,
          expiresAt: snapshot.expiresAt,
        }),
      }).catch(() => {
        // Local train state still works even if the status file update fails.
      });
    }
    broadcastSupportTrainRuntime();
  }

  function loadPersistedSupportTrain() {
    const nextTrain = createSupportTrainState();

    try {
      const raw = window.localStorage.getItem(SUPPORT_TRAIN_STORAGE_KEY);
      if (!raw) {
        return nextTrain;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return nextTrain;
      }

      const snapshot = buildSupportTrainSnapshot(parsed);
      Object.assign(nextTrain, snapshot);
      if (snapshot.active && snapshot.expiresAt > Date.now()) {
        scheduleSupportTrainEnd(nextTrain);
      }
    } catch (error) {
      return nextTrain;
    }

    return nextTrain;
  }

  function syncSupportTrainFromStorage(options = {}) {
    const previousTrain = state.supportTrain || createSupportTrainState();
    if (previousTrain.endTimer) {
      window.clearTimeout(previousTrain.endTimer);
    }

    const nextTrain = loadPersistedSupportTrain();
    state.supportTrain = nextTrain;
    renderSupportTrainHud();

    if (!options.triggerBurst || !config.trainOnly) {
      return;
    }

    const pointsIncreased = nextTrain.active && nextTrain.totalPoints > (previousTrain.totalPoints || 0);
    const levelIncreased = nextTrain.active && nextTrain.level > (previousTrain.level || 0);
    const trainStarted = nextTrain.active && !previousTrain.active;
    if (levelIncreased) {
      triggerSupportTrainHudBurst("levelup");
      return;
    }
    if (trainStarted || pointsIncreased) {
      triggerSupportTrainHudBurst(trainStarted ? "start" : "step");
    }
  }

  function initRuntimeSyncChannel() {
    if (!("BroadcastChannel" in window)) {
      return;
    }

    try {
      const channel = new BroadcastChannel(RUNTIME_SYNC_CHANNEL_NAME);
      channel.onmessage = handleRuntimeSyncMessage;
      state.runtimeChannel = channel;
    } catch (error) {
      state.runtimeChannel = null;
    }
  }

  function handleRuntimeSyncMessage(event) {
    const payload = event && event.data;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.type === "overlay-settings" && payload.settings && typeof payload.settings === "object") {
      const nextSettings = {
        streamLiteEffects: payload.settings.streamLiteEffects !== undefined ? !!payload.settings.streamLiteEffects : !!payload.settings.liteEffects,
        dockLiteEffects: payload.settings.dockLiteEffects !== undefined ? !!payload.settings.dockLiteEffects : !!payload.settings.liteEffects,
        streamShowFollowAlerts: payload.settings.streamShowFollowAlerts !== undefined ? payload.settings.streamShowFollowAlerts !== false : payload.settings.showFollowAlerts !== false,
        dockShowFollowAlerts: payload.settings.dockShowFollowAlerts !== undefined ? payload.settings.dockShowFollowAlerts !== false : payload.settings.showFollowAlerts !== false,
        streamIgnoreBangCommands: payload.settings.streamIgnoreBangCommands !== undefined ? !!payload.settings.streamIgnoreBangCommands : !!payload.settings.ignoreBangCommands,
        dockIgnoreBangCommands: payload.settings.dockIgnoreBangCommands !== undefined ? !!payload.settings.dockIgnoreBangCommands : !!payload.settings.ignoreBangCommands,
        streamHideDeletedMessages: payload.settings.streamHideDeletedMessages !== undefined ? !!payload.settings.streamHideDeletedMessages : !!payload.settings.hideDeletedMessages,
        dockHideDeletedMessages: payload.settings.dockHideDeletedMessages !== undefined ? !!payload.settings.dockHideDeletedMessages : false,
        streamShowStatus: payload.settings.streamShowStatus !== undefined ? payload.settings.streamShowStatus !== false : false,
        dockShowStatus: payload.settings.dockShowStatus !== undefined ? payload.settings.dockShowStatus !== false : true,
        ignoreUsersStream: Array.isArray(payload.settings.ignoreUsersStream)
          ? payload.settings.ignoreUsersStream.map((value) => normalizeUserName(value)).filter(Boolean)
          : [],
        ignoreUsersDock: Array.isArray(payload.settings.ignoreUsersDock)
          ? payload.settings.ignoreUsersDock.map((value) => normalizeUserName(value)).filter(Boolean)
          : [],
        trainPosition: ["top-left", "bottom-left", "bottom-center"].includes(String(payload.settings.trainPosition || "").trim().toLowerCase())
          ? String(payload.settings.trainPosition).trim().toLowerCase()
          : "bottom-left",
        trainWidth: parseStoredTrainWidth(payload.settings.trainWidth, parseOptionalPixelValue(config.trainWidth)),
        trainScale: parseStoredTrainScale(payload.settings.trainScale, Number.isFinite(config.trainScale) ? config.trainScale : 1),
        trainCompact: !!payload.settings.trainCompact,
      };

      if (getOverlaySettingsSignature(nextSettings) === getOverlaySettingsSignature(state.overlaySettings)) {
        return;
      }

      state.overlaySettings = nextSettings;
      applyOverlaySettingsState({ skipPersist: true });
      if (state.settingsDialogOpen) {
        syncSettingsForm();
      }
      return;
    }

    if (payload.type === "support-train" && payload.train && typeof payload.train === "object") {
      const previousTrain = state.supportTrain || createSupportTrainState();
      if (previousTrain.endTimer) {
        window.clearTimeout(previousTrain.endTimer);
      }

      const nextTrain = createSupportTrainState();
      Object.assign(nextTrain, buildSupportTrainSnapshot(payload.train));
      if (nextTrain.active && nextTrain.expiresAt > Date.now()) {
        scheduleSupportTrainEnd(nextTrain);
      }
      state.supportTrain = nextTrain;
      renderSupportTrainHud();
    }
  }

  function broadcastRuntimeSyncMessage(payload) {
    if (!state.runtimeChannel || !payload || typeof payload !== "object") {
      return;
    }

    try {
      state.runtimeChannel.postMessage(payload);
    } catch (error) {
      // Ignore broadcast failures; other sync paths still exist.
    }
  }

  function broadcastOverlaySettingsRuntime() {
    broadcastRuntimeSyncMessage({
      type: "overlay-settings",
      settings: state.overlaySettings,
    });
  }

  function broadcastSupportTrainRuntime() {
    broadcastRuntimeSyncMessage({
      type: "support-train",
      train: buildSupportTrainSnapshot(state.supportTrain),
    });
  }

  function updatePlatformConnection(platformKey, connected, quiet) {
    const platform = state.platforms[platformKey];
    if (!platform) {
      return;
    }

    platform.connected = connected;
    platform.accountConnected = connected;
    platform.label = connected ? "Connected" : "Disconnected";
    platform.tone = connected ? "connected" : "disconnected";

    if (!connected) {
      platform.chatConfirmed = false;
    }

    persistPlatformRuntimeState();

    if (!quiet) {
      renderStatus();
    }
  }

  function setSocketState(tone, label) {
    const socket = state.platforms.streamerbot;
    socket.connected = tone === "connected";
    socket.accountConnected = socket.connected;
    socket.chatConfirmed = socket.connected;
    socket.tone = tone;
    socket.label = label;
    if (tone === "connected") {
      socket.lastMessageAt = Date.now();
    }
    persistPlatformRuntimeState();
  }

  function handleBrowserOffline() {
    if (!state.internetOnline) {
      return;
    }

    state.internetOnline = false;
    state.setupComplete = false;
    showToast("Internet disconnected. Chat may stop updating.", "danger");
    renderStatus();
  }

  function handleBrowserOnline() {
    if (state.internetOnline) {
      return;
    }

    state.internetOnline = true;
    showToast("Internet restored. Re-syncing chat...", "ok");
    scheduleResumeRecovery("browser-online");
  }

  async function recoverLiveConnection() {
    loadPersistedFeed();

    if (!state.socket || state.socket.readyState === WebSocket.CLOSED) {
      connect();
      return;
    }

    if (state.socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      state.setupComplete = false;
      renderStatus();
      await subscribeToEvents();
      await syncBroadcasterStatus();
      await sendRequest("GetInfo", null, { timeoutMs: config.requestTimeoutMs });
      state.setupComplete = true;
      state.lastSocketActivityAt = Date.now();
      renderStatus();
      persistPlatformRuntimeState();
      showToast("Chat is back in sync.", "ok");
    } catch (error) {
      forceSocketReconnect("Connection refresh failed. Reconnecting...");
    }
  }

  function forceSocketReconnect(reason) {
    if (reason) {
      showToast(reason, "danger");
    }

    state.setupComplete = false;
    clearReconnectTimer();

    if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) {
      try {
        state.socket.close();
        return;
      } catch (error) {
        // Fall through to a fresh connect attempt.
      }
    }

    if (state.internetOnline) {
      connect();
    }
  }

  function scheduleResumeRecovery(reason) {
    if (state.resumeRecoveryTimer) {
      window.clearTimeout(state.resumeRecoveryTimer);
    }

    state.resumeRecoveryTimer = window.setTimeout(() => {
      state.resumeRecoveryTimer = 0;
      void recoverAfterResume(reason);
    }, 400);
  }

  async function recoverAfterResume(reason) {
    if (state.liveRecoveryInFlight || document.visibilityState === "hidden") {
      return;
    }

    state.liveRecoveryInFlight = true;

    try {
      loadPersistedFeed();

      if (!isLocalOnlyMode()) {
        connectHistoryStream();
        pollPersistedFeed();
      }

      await recoverLiveConnection();
    } catch (error) {
      // The reconnect/recovery helpers already manage their own fallback path.
    } finally {
      state.liveRecoveryInFlight = false;
    }
  }

  function handlePageResume() {
    scheduleResumeRecovery("page-resume");
  }

  function runLiveRecoveryCheck() {
    if (!state.internetOnline || document.visibilityState === "hidden") {
      return;
    }

    if (!isLocalOnlyMode() && !state.historyEventSource) {
      connectHistoryStream();
    }

    if (!state.socket || state.socket.readyState === WebSocket.CLOSED) {
      scheduleResumeRecovery("socket-closed");
      return;
    }

    if (state.socket.readyState === WebSocket.CONNECTING || !state.setupComplete) {
      return;
    }

    const now = Date.now();
    const lastActivity = state.lastSocketActivityAt || state.connectedAt || 0;
    if (lastActivity && now - lastActivity > Math.max(config.heartbeatIntervalMs * 2, 45000)) {
      scheduleResumeRecovery("socket-idle");
    }
  }

  async function runHeartbeatCheck() {
    if (!state.internetOnline || !state.setupComplete || state.heartbeatInFlight) {
      return;
    }

    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    state.heartbeatInFlight = true;

    try {
      await sendRequest("GetInfo", null, { timeoutMs: config.requestTimeoutMs });
    } catch (error) {
      forceSocketReconnect("Connection stalled. Reconnecting...");
    } finally {
      state.heartbeatInFlight = false;
    }
  }

  function normalizeMessage(platformKey, type, data) {
    if (!PLATFORM_META[platformKey]) {
      return null;
    }

    if (platformKey === "twitch" && type === "ChatMessage") {
      const badges = extractBadgeNames((data.user && data.user.badges) || (data.message && data.message.badges));
      const variant = getChatMessageVariant(platformKey, badges, data);
      const text = pickFirstString(data, ["text", "meta.text", "message.message"]) || "[empty message]";
      return {
        platform: platformKey,
        messageId: extractMessageId(platformKey, data),
        userId: extractUserId(platformKey, data),
        variant,
        username: pickFirstString(data, ["user.name", "message.displayName", "message.username", "user.login"]) || "Twitch User",
        text,
        contentParts: extractMessageContentParts(platformKey, data, text),
        badges,
        color: pickFirstString(data, ["user.color", "message.color"]),
        avatarUrl: extractAvatarUrl(platformKey, data),
        isBroadcaster: isBroadcasterMessage(platformKey, data),
        memberLabel: variant === "member" ? getMembershipLabel(platformKey, data) : "",
        timestamp: Date.now(),
      };
    }

    if (platformKey === "kick" && type === "ChatMessage") {
      const badges = extractBadgeNames(data.user && data.user.badges);
      const variant = getChatMessageVariant(platformKey, badges, data);
      const text = pickFirstString(data, ["text"]) || joinTextParts(data.parts) || "[empty message]";
      return {
        platform: platformKey,
        messageId: extractMessageId(platformKey, data),
        userId: extractUserId(platformKey, data),
        variant,
        username: pickFirstString(data, ["user.name", "user.login"]) || "Kick User",
        text,
        contentParts: extractMessageContentParts(platformKey, data, text),
        badges,
        color: pickFirstString(data, ["user.color"]),
        avatarUrl: extractAvatarUrl(platformKey, data),
        isBroadcaster: isBroadcasterMessage(platformKey, data),
        memberLabel: variant === "member" ? getMembershipLabel(platformKey, data) : "",
        timestamp: Date.now(),
      };
    }

    if (platformKey === "youtube" && type === "Message") {
      const badges = extractYouTubeBadgeNames(data);
      const variant = getChatMessageVariant(platformKey, badges, data);
      const text = pickFirstString(data, ["message", "text", "displayMessage", "snippet.displayMessage", "snippet.textMessageDetails.messageText"]) || objectSummary(data);
      debugYouTubeMessagePayload(data, {
        type,
        username: pickFirstString(data, ["user.name", "author.name", "displayName", "authorDisplayName", "snippet.authorDisplayName"]) || "YouTube User",
        badges,
        variant,
        memberLabel: variant === "member" ? getMembershipLabel(platformKey, data) : "",
      });
      return {
        platform: platformKey,
        messageId: extractMessageId(platformKey, data),
        userId: extractUserId(platformKey, data),
        variant,
        username: pickFirstString(data, ["user.name", "author.name", "displayName", "authorDisplayName", "snippet.authorDisplayName"]) || "YouTube User",
        text,
        contentParts: extractMessageContentParts(platformKey, data, text),
        badges,
        color: null,
        avatarUrl: extractAvatarUrl(platformKey, data),
        isBroadcaster: isBroadcasterMessage(platformKey, data),
        memberLabel: variant === "member" ? getMembershipLabel(platformKey, data) : "",
        timestamp: Date.now(),
      };
    }

    if (isSpecialEvent(platformKey, type) || isKickGiftItemEvent(platformKey, type, data)) {
      return buildSpecialMessage(platformKey, type, data);
    }

    return null;
  }

  function debugYouTubeMessagePayload(data, derived) {
    if (window.location.protocol === "file:") {
      return;
    }

    const payload = {
      derived: derived || {},
      raw: data || {},
    };

    fetch(YOUTUBE_DEBUG_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Debug capture should never interrupt live rendering.
    });
  }

  function debugRuntimeIssue(kind, details) {
    if (window.location.protocol === "file:") {
      return;
    }

    fetch(RUNTIME_DEBUG_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: String(kind || "runtime"),
        details: details || {},
      }),
    }).catch(() => {
      // Debug capture should never interrupt rendering.
    });
  }

  function appendDebugPayload(apiPath, payload) {
    if (window.location.protocol === "file:" || !apiPath || !payload || typeof payload !== "object") {
      return;
    }

    fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Debug capture should never interrupt rendering.
    });
  }

  function debugKickViewerPayload(eventType, data, extractedViewerCount) {
    appendDebugPayload(KICK_VIEWER_DEBUG_API_PATH, {
      type: String(eventType || ""),
      extractedViewerCount: typeof extractedViewerCount === "number" ? extractedViewerCount : null,
      raw: data || {},
    });
  }

  function traceFirstString(obj, paths) {
    for (const path of paths) {
      const value = getValueByPath(obj, path);
      if (typeof value === "string" && value.trim()) {
        return { path, value: value.trim() };
      }
    }
    return { path: "", value: "" };
  }

  function traceFirstNumber(obj, paths) {
    for (const path of paths) {
      const value = getValueByPath(obj, path);
      if (typeof value === "number" && Number.isFinite(value)) {
        return { path, value };
      }
      if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
        return { path, value: Number(value) };
      }
    }
    return { path: "", value: null };
  }

  function debugKickGiftEvent(type, data, message) {
    const usernameTrace = traceFirstString(data, ["userName", "displayName", "user", "user.name", "gifter.name", "sender.name", "username", "name"]);
    const amountTrace = traceFirstNumber(data, ["kicks.amount", "amount", "qty", "giftAmount", "gift_amount", "giftValue", "gift.value", "kicks"]);
    const giftNameTrace = traceFirstString(data, ["giftName", "gift.name", "gift.title", "lastGiftName", "giftId", "gift.id", "gift.slug", "gift.key"]);
    const mediaTrace = traceFirstString(data, ["giftImageUrl", "gift.imageUrl", "gift.image.url", "giftUrl", "gift.url", "assetUrl", "imageUrl"]);
    const recipientTrace = traceFirstString(data, ["recipientUserName", "recipient.name", "recipient.login", "to"]);
    const countTrace = traceFirstNumber(data, ["subBombCount", "sub_gift_count", "gift_amount", "amount", "qty", "count", "subscription.count", "gifts.count", "gift_count", "gifted_count", "subscriptions", "subs", "sub_count", "total_gifts"]);

    appendDebugPayload(KICK_GIFTS_DEBUG_API_PATH, {
      type: String(type || ""),
      derived: {
        username: message && message.username ? message.username : "",
        text: message && message.text ? message.text : "",
        amountText: message && message.amountText ? message.amountText : "",
        tone: message && message.tone ? message.tone : "",
        badges: message && Array.isArray(message.badges) ? message.badges : [],
        giftId: message && message.giftId ? message.giftId : "",
        giftName: message && message.giftName ? message.giftName : "",
        giftImageUrl: message && message.giftImageUrl ? message.giftImageUrl : "",
        loopWord: message ? getLoopBackgroundWord(message) : "",
      },
      resolution: {
        username: usernameTrace,
        amount: amountTrace,
        giftName: giftNameTrace,
        media: mediaTrace,
        recipient: recipientTrace,
        count: countTrace,
        recipientListCount: countRecipientList(data),
        indexedRecipientCount: countIndexedRecipients(data),
        classifiedAsDirectKicks: isKickDirectKicksEvent("kick", type, data),
        classifiedAsGiftItem: isKickGiftItemEvent("kick", type, data),
      },
      raw: data || {},
    });

    if (!(message && message.username) || (!(message && message.amountText) && !(message && message.giftName))) {
      appendDebugPayload(PARSE_FAILURE_DEBUG_API_PATH, {
        kind: "kick-gift-parse",
        type: String(type || ""),
        derived: message || {},
        raw: data || {},
      });
    }
  }

  function debugYouTubePaidEvent(type, data, message) {
    const usernameTrace = traceFirstString(data, [
      "username", "user.name", "user.displayName", "user.username", "user", "userName",
      "author.name", "author.userName", "author.displayName", "displayName", "authorDisplayName", "name",
    ]);
    const amountTrace = traceFirstString(data, ["amount", "formattedAmount", "amountFormatted", "amountDisplayString", "displayAmount"]);
    const microAmountTrace = traceFirstNumber(data, ["microAmount"]);
    const currencyTrace = traceFirstString(data, ["currencyCode", "currency"]);
    const stickerIdTrace = traceFirstString(data, ["stickerId", "superStickerMetadata.stickerId", "sticker.id", "giftId"]);
    const imageTrace = traceFirstString(data, [
      "imageUrl", "stickerImageUrl", "sticker.imageUrl", "superStickerMetadata.imageUrl",
      "giftImageUrl", "gift.imageUrl", "gift.image.url",
    ]);
    const recipientTrace = traceFirstString(data, ["recipientUserName", "recipient.name", "recipient.login", "to", "member.name", "member.displayName"]);
    const countTrace = traceFirstNumber(data, ["count", "gifted", "quantity", "totalGifted", "totalSubsGifted", "amount"]);

    appendDebugPayload(YOUTUBE_PAID_DEBUG_API_PATH, {
      type: String(type || ""),
      derived: {
        username: message && message.username ? message.username : "",
        text: message && message.text ? message.text : "",
        amountText: message && message.amountText ? message.amountText : "",
        tone: message && message.tone ? message.tone : "",
        badges: message && Array.isArray(message.badges) ? message.badges : [],
        giftId: message && message.giftId ? message.giftId : "",
        giftName: message && message.giftName ? message.giftName : "",
        giftImageUrl: message && message.giftImageUrl ? message.giftImageUrl : "",
      },
      resolution: {
        username: usernameTrace,
        amount: amountTrace,
        microAmount: microAmountTrace,
        currency: currencyTrace,
        stickerId: stickerIdTrace,
        image: imageTrace,
        recipient: recipientTrace,
        count: countTrace,
      },
      raw: data || {},
    });

    if (
      !(message && message.username) ||
      ((type === "SuperSticker" || type === "MembershipGift" || type === "GiftMembershipReceived") &&
        !(message && (message.giftId || message.giftImageUrl || message.amountText)))
    ) {
      appendDebugPayload(PARSE_FAILURE_DEBUG_API_PATH, {
        kind: "youtube-paid-parse",
        type: String(type || ""),
        derived: message || {},
        raw: data || {},
      });
    }
  }

  function debugGiftRecipientEvent(platformKey, type, data, message) {
    const recipientTrace = traceFirstString(data, ["recipientUserName", "recipient.name", "recipient.login", "to", "member.name", "member.displayName"]);
    const gifterTrace = traceFirstString(data, ["userName", "displayName", "user", "user.name", "gifter.name", "sender.name", "username", "name"]);

    appendDebugPayload(GIFT_RECIPIENT_DEBUG_API_PATH, {
      platform: String(platformKey || ""),
      type: String(type || ""),
      derived: {
        username: message && message.username ? message.username : "",
        text: message && message.text ? message.text : "",
        badges: message && Array.isArray(message.badges) ? message.badges : [],
        tone: message && message.tone ? message.tone : "",
      },
      resolution: {
        recipient: recipientTrace,
        gifter: gifterTrace,
      },
      raw: data || {},
    });

    if ((type === "GiftSub" || type === "GiftSubscription" || type === "GiftMembershipReceived") && !recipientTrace.value) {
      appendDebugPayload(PARSE_FAILURE_DEBUG_API_PATH, {
        kind: "gift-recipient-missing",
        platform: String(platformKey || ""),
        type: String(type || ""),
        derived: message || {},
        raw: data || {},
      });
    }
  }

  function getChatMessageVariant(platformKey, badges, data) {
    if (hasMemberContext(platformKey, badges, data)) {
      return "member";
    }
    return "chat";
  }

  function hasMemberContext(platformKey, badges, data) {
    if (Array.isArray(badges) && badges.some((badge) => isMemberBadge(String(badge || "").trim().toLowerCase()))) {
      return true;
    }

    const platformChecks = {
      twitch: ["user.isSubscriber", "message.isSubscriber", "isSubscriber", "isSubscriberMessage"],
      kick: ["user.isSubscriber", "user.isMember", "isSubscriber", "isMember"],
      youtube: [
        "author.isChatSponsor",
        "author.isSponsor",
        "authorDetails.isChatSponsor",
        "authorDetails.isSponsor",
        "snippet.authorDetails.isChatSponsor",
        "snippet.authorDetails.isSponsor",
        "message.authorDetails.isChatSponsor",
        "message.authorDetails.isSponsor",
        "user.isMember",
        "user.isSponsor",
        "user.isChatSponsor",
        "isMember",
        "isSponsor",
        "isChatSponsor",
        "isSubscriber",
      ],
    };

    if (platformKey === "youtube") {
      const youtubeBadgeFallback = extractBadgeNames(
        getValueByPath(data, "author.badges") ||
        getValueByPath(data, "user.badges") ||
        getValueByPath(data, "authorDetails.authorBadges") ||
        getValueByPath(data, "snippet.authorDetails.authorBadges") ||
        getValueByPath(data, "message.authorDetails.authorBadges") ||
        getValueByPath(data, "badges"),
      );
      if (youtubeBadgeFallback.some((badge) => isMemberBadge(String(badge || "").trim().toLowerCase()))) {
        return true;
      }

      if (pickFirstString(data, [
        "author.membershipLevelName",
        "author.memberLevelName",
        "author.sponsorLevelName",
        "authorDetails.membershipLevelName",
        "authorDetails.memberLevelName",
        "authorDetails.sponsorLevelName",
        "snippet.authorDetails.membershipLevelName",
        "snippet.authorDetails.memberLevelName",
        "snippet.authorDetails.sponsorLevelName",
        "message.authorDetails.membershipLevelName",
        "message.authorDetails.memberLevelName",
        "message.authorDetails.sponsorLevelName",
        "user.membershipLevelName",
        "user.memberLevelName",
        "user.sponsorLevelName",
        "membershipLevelName",
        "memberLevelName",
        "sponsorLevelName",
        "sponsorLevel",
      ])) {
        return true;
      }
    }

    return pickFirstBoolean(data, platformChecks[platformKey] || []);
  }

  function getMembershipLabel(platformKey, data) {
    if (platformKey === "youtube") {
      return "YT Member";
    }
    if (platformKey === "twitch") {
      return "Twitch Sub";
    }
    if (platformKey === "kick") {
      return "Kick Sub";
    }
    return `${PLATFORM_META[platformKey].label} Member`;
  }

  function isSpecialEvent(platformKey, type) {
    const map = {
      twitch: ["Follow", "Raid", "RewardRedemption", "Cheer", "Sub", "ReSub", "GiftSub", "GiftBomb", "CoinCheer", "CharityDonation", "HypeTrainStart", "HypeTrainUpdate", "HypeTrainLevelUp", "HypeTrainEnd"],
      kick: ["Follow", "Raid", "RewardRedemption", "Subscription", "Resubscription", "GiftSubscription", "MassGiftSubscription", "sGifted", "KicksGifted"],
      youtube: ["NewSubscriber", "SuperChat", "SuperSticker", "NewSponsor", "MembershipGift", "GiftMembershipReceived"],
      streamlabs: ["Donation", "Merchandise"],
      streamelements: ["Tip"],
      kofi: ["Donation", "Subscription", "Resubscription"],
      fourthwall: ["Donation", "SubscriptionPurchased", "GiftPurchase"],
    };

    return (map[platformKey] || []).includes(type);
  }

  function buildSpecialMessage(platformKey, type, data) {
    const kickGiftMeta = platformKey === "kick" && isKickGiftItemEvent(platformKey, type, data)
      ? extractKickGiftMeta(data)
      : null;
    const youtubeStickerMeta = platformKey === "youtube" && type === "SuperSticker"
      ? extractYouTubeSuperStickerMeta(data)
      : null;
    const message = {
      platform: platformKey,
      messageId: extractMessageId(platformKey, data),
      userId: extractUserId(platformKey, data),
      variant: "special",
      username: pickSpecialUsername(platformKey, data),
      text: buildSpecialText(platformKey, type, data),
      badges: buildSpecialBadges(platformKey, type, data, kickGiftMeta),
      color: null,
      avatarUrl: extractAvatarUrl(platformKey, data),
      isBroadcaster: isBroadcasterMessage(platformKey, data),
      amountText: extractSupportAmount(platformKey, type, data),
      tone: getSpecialTone(platformKey, type, data),
      paidEntryEffect: shouldUsePaidEntryEffect(platformKey, type, data),
      giftId: kickGiftMeta
        ? kickGiftMeta.id
        : (youtubeStickerMeta ? youtubeStickerMeta.id : ""),
      giftName: kickGiftMeta
        ? kickGiftMeta.name
        : (youtubeStickerMeta ? youtubeStickerMeta.title : ""),
      giftImageUrl: kickGiftMeta
        ? kickGiftMeta.imageUrl
        : (youtubeStickerMeta ? youtubeStickerMeta.imageUrl : ""),
      timestamp: Date.now(),
    };

    if (platformKey === "youtube" && ["SuperChat", "SuperSticker", "MembershipGift", "GiftMembershipReceived"].includes(type)) {
      debugYouTubePaidEvent(type, data, message);
    }

    if (platformKey === "kick" && (isKickGiftItemEvent(platformKey, type, data) || isKickDirectKicksEvent(platformKey, type, data))) {
      debugKickGiftEvent(type, data, message);
    }

    if (
      ["youtube.GiftMembershipReceived", "twitch.GiftSub", "kick.GiftSubscription"].includes(`${platformKey}.${type}`)
    ) {
      debugGiftRecipientEvent(platformKey, type, data, message);
    }

    return message;
  }

  function buildSpecialBadges(platformKey, type, data, kickGiftMeta) {
    if (platformKey === "kick" && isKickGiftItemEvent(platformKey, type, data)) {
      return [kickGiftMeta && kickGiftMeta.name ? kickGiftMeta.name : "Kick Gift"];
    }

    if (platformKey === "kick" && isKickDirectKicksEvent(platformKey, type, data)) {
      return ["Kicks"];
    }

    switch (`${platformKey}.${type}`) {
      case "twitch.Follow":
      case "kick.Follow":
        return ["Follow"];
      case "twitch.Raid":
      case "kick.Raid":
        return ["Raid"];
      case "twitch.HypeTrainStart":
      case "twitch.HypeTrainUpdate":
      case "twitch.HypeTrainLevelUp":
      case "twitch.HypeTrainEnd":
        return ["Hype Train"];
      case "twitch.RewardRedemption":
      case "kick.RewardRedemption":
        return ["Redeem"];
      case "streamlabs.Merchandise":
        return ["Store Redeem"];
      case "youtube.NewSubscriber":
        return ["Subscriber"];
      case "kick.Subscription":
      case "kick.Resubscription":
      case "youtube.NewSponsor":
      case "twitch.Sub":
      case "twitch.ReSub":
        return ["Supporter"];
      case "kick.GiftSubscription":
      case "twitch.GiftSub":
        return ["Gifted Sub"];
      case "kick.MassGiftSubscription":
      case "kick.sGifted":
      case "twitch.GiftBomb":
        return ["Gift Bomb"];
      case "twitch.Cheer":
      case "twitch.CoinCheer":
        return ["Cheer"];
      default:
        break;
    }

    return [formatBadgeLabel(type)];
  }

  function isKickGiftItemEvent(platformKey, type, data) {
    if (platformKey !== "kick") {
      return false;
    }

    const subscriptionTypes = new Set([
      "ChatMessage",
      "BroadcasterChatConnected",
      "BroadcasterChatDisconnected",
      "ViewerCountUpdate",
      "Subscription",
      "Resubscription",
      "GiftSubscription",
      "MassGiftSubscription",
      "sGifted",
    ]);
    if (subscriptionTypes.has(type)) {
      return hasExplicitKickGiftIndicators(data);
    }

    const excludedTypes = new Set([
      "ChatMessage",
      "BroadcasterChatConnected",
      "BroadcasterChatDisconnected",
      "ViewerCountUpdate",
      "Subscription",
      "Resubscription",
    ]);
    if (excludedTypes.has(type)) {
      return false;
    }

    const meta = extractKickGiftMeta(data);
    if (meta) {
      return true;
    }

    return hasExplicitKickGiftIndicators(data);
  }

  function isKickDirectKicksEvent(platformKey, type, data) {
    if (platformKey !== "kick") {
      return false;
    }

    const normalizedType = String(type || "").trim().toLowerCase();
    if (!normalizedType.includes("kicksgifted")) {
      return false;
    }

    if (isKickGiftItemEvent(platformKey, type, data) || hasExplicitKickGiftIndicators(data)) {
      return false;
    }

    return extractKickGiftAmount(data) !== null;
  }

  function hasExplicitKickGiftIndicators(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    const explicitGiftText = pickFirstString(data, [
      "giftId",
      "gift.id",
      "gift.slug",
      "gift.key",
      "lastGiftId",
      "giftName",
      "gift.name",
      "gift.title",
      "lastGiftName",
      "giftImageUrl",
      "gift.imageUrl",
      "gift.image.url",
      "giftUrl",
      "gift.url",
      "assetUrl",
      "imageUrl",
    ]);
    if (explicitGiftText) {
      return true;
    }

    return pickFirstNumber(data, [
      "kicks",
      "giftAmount",
      "gift_amount",
      "giftValue",
      "gift.value",
    ]) !== null;
  }

  function pickSpecialUsername(platformKey, data) {
    const byPlatform = {
      twitch: ["userName", "user.name", "fromUserName", "recipientUserName"],
      kick: ["userName", "displayName", "user", "user.name", "user.login", "gifter.name", "gifter.login", "sender.name", "sender.login", "username", "name"],
      youtube: [
        "username",
        "user.name",
        "user.displayName",
        "user.username",
        "user.login",
        "user",
        "userName",
        "subscriber.user",
        "subscriber.userName",
        "subscriber.name",
        "subscriber.displayName",
        "author.name",
        "author.userName",
        "author.displayName",
        "displayName",
        "authorDisplayName",
        "snippet.authorDisplayName",
        "event.user",
        "event.userName",
        "event.displayName",
        "eventData.user",
        "eventData.userName",
        "eventData.displayName",
        "data.user",
        "data.userName",
        "data.displayName",
        "name",
      ],
      streamlabs: ["from", "name"],
      streamelements: ["username", "name"],
      kofi: ["fromName", "name"],
      fourthwall: ["username", "name", "buyerName"],
    };

    const value = pickFirstString(data, byPlatform[platformKey] || []);
    return value || `${PLATFORM_META[platformKey].label} Alert`;
  }

  function buildSpecialText(platformKey, type, data) {
    if (platformKey === "kick" && isKickGiftItemEvent(platformKey, type, data)) {
      const giftMeta = extractKickGiftMeta(data);
      const note = pickFirstString(data, ["userComment", "message", "displayMessage", "text"]);
      const pieces = [`sent ${giftMeta && giftMeta.name ? giftMeta.name : "a Kick gift"}`];
      if (note && note.toLowerCase() !== pieces[0].toLowerCase()) {
        pieces.push(note);
      }
      return pieces.join(" ").trim();
    }

    if (platformKey === "kick" && isKickDirectKicksEvent(platformKey, type, data)) {
      const note = pickFirstString(data, ["userComment", "message", "displayMessage", "text"]);
      const pieces = ["sent Kicks"];
      if (note && note.toLowerCase() !== pieces[0].toLowerCase()) {
        pieces.push(note);
      }
      return pieces.join(" ").trim();
    }

    const amount = extractSupportAmount(platformKey, type, data) ||
      pickFirstString(data, ["formattedAmount", "amount", "tier", "plan", "subscriptionTier", "currency"]);
    const count = [
      "kick.MassGiftSubscription",
      "kick.sGifted",
      "kick.KicksGifted",
      "twitch.GiftBomb",
      "youtube.MembershipGift",
    ].includes(`${platformKey}.${type}`)
      ? resolveMassGiftCount(data)
      : pickFirstNumber(data, ["count", "months", "cumulativeMonths", "gifted", "quantity", "totalSubsGifted"]);
    const recipient = pickFirstString(data, ["recipientUserName", "recipient.name", "recipient.login", "to"]);
    const note = pickFirstString(data, ["userComment", "message", "displayMessage", "tipMessage"]);

    const pieces = [];
    switch (`${platformKey}.${type}`) {
      case "twitch.Follow":
      case "kick.Follow":
        pieces.push("started following");
        break;
      case "twitch.Raid": {
        const raider = pickFirstString(data, [
          "fromBroadcasterUserName",
          "fromBroadcaster.userName",
          "fromUserName",
          "raider.name",
          "raider.login",
        ]);
        const viewers = pickFirstNumber(data, ["viewers", "viewerCount", "raidViewers"]);
        pieces.push(raider ? `raided with ${raider}` : "started a raid");
        if (viewers !== null) {
          pieces.push(`${formatPlainNumber(viewers)} viewers`);
        }
        break;
      }
      case "kick.Raid": {
        const raider = pickFirstString(data, [
          "raider.name",
          "raider.login",
          "fromUserName",
          "host.name",
        ]);
        const viewers = pickFirstNumber(data, ["viewers", "viewerCount", "raidViewers"]);
        pieces.push(raider ? `raided with ${raider}` : "started a raid");
        if (viewers !== null) {
          pieces.push(`${formatPlainNumber(viewers)} viewers`);
        }
        break;
      }
      case "twitch.HypeTrainStart":
        pieces.push("started a Hype Train");
        break;
      case "twitch.HypeTrainUpdate":
      case "twitch.HypeTrainLevelUp":
      case "twitch.HypeTrainEnd": {
        const level = pickFirstNumber(data, ["level", "hypeTrain.level"]);
        const percent = pickFirstNumber(data, ["progress", "progressPercentage", "percent", "goalProgress"]);
        if (type === "HypeTrainEnd") {
          pieces.push("Hype Train ended");
        } else if (type === "HypeTrainLevelUp") {
          pieces.push(level !== null ? `reached Hype Train level ${level}` : "leveled up the Hype Train");
        } else {
          pieces.push(level !== null ? `Hype Train level ${level}` : "Hype Train is rolling");
        }
        if (percent !== null && type !== "HypeTrainEnd") {
          pieces.push(`${Math.round(percent)}%`);
        }
        break;
      }
      case "twitch.RewardRedemption":
      case "kick.RewardRedemption": {
        const rewardTitle = pickFirstString(data, [
          "reward.title",
          "reward.name",
          "rewardTitle",
          "title",
          "name",
          "redemption.reward.title",
        ]);
        pieces.push(rewardTitle ? `redeemed ${rewardTitle}` : "redeemed a reward");
        break;
      }
      case "youtube.NewSubscriber":
        pieces.push("subscribed on YouTube");
        break;
      case "youtube.SuperChat":
        pieces.push("sent a Super Chat");
        break;
      case "youtube.SuperSticker":
        pieces.push("sent a Super Sticker");
        break;
      case "youtube.NewSponsor":
        pieces.push("became a member");
        break;
      case "youtube.MembershipGift":
        pieces.push("gifted memberships");
        break;
      case "youtube.GiftMembershipReceived":
        pieces.push("received a gifted membership");
        break;
      case "kick.Subscription":
      case "kick.Resubscription":
        pieces.push("subscribed on Kick");
        break;
      case "kick.GiftSubscription":
        pieces.push(`gifted a Kick sub${recipient ? ` to ${recipient}` : ""}`);
        break;
      case "kick.MassGiftSubscription":
      case "kick.sGifted":
        pieces.push("gifted subs to the chat");
        break;
      case "twitch.Cheer":
      case "twitch.CoinCheer":
        pieces.push("sent bits");
        break;
      case "twitch.Sub":
      case "twitch.ReSub":
        pieces.push("subscribed on Twitch");
        break;
      case "twitch.GiftSub":
        pieces.push(`gifted a Twitch sub${recipient ? ` to ${recipient}` : ""}`);
        break;
      case "twitch.GiftBomb":
        pieces.push("gifted subs to the community");
        break;
      case "twitch.CharityDonation":
      case "streamlabs.Donation":
      case "kofi.Donation":
      case "fourthwall.Donation":
        pieces.push("sent a donation");
        break;
      case "streamlabs.Merchandise": {
        const merchName = pickFirstString(data, [
          "productName",
          "itemName",
          "item.name",
          "merchandise.name",
          "name",
          "title",
        ]);
        const quantity = pickFirstNumber(data, ["quantity", "count", "amount"]);
        pieces.push(merchName ? `redeemed ${merchName}` : "redeemed a store item");
        if (quantity !== null && quantity > 1) {
          pieces.push(`x${quantity}`);
        }
        break;
      }
      case "streamelements.Tip":
        break;
      case "kofi.Subscription":
      case "kofi.Resubscription":
      case "fourthwall.SubscriptionPurchased":
        pieces.push("started a membership");
        break;
      case "fourthwall.GiftPurchase":
        pieces.push("sent a gift purchase");
        break;
      default:
        pieces.push(type);
        break;
    }

    if (amount && !supportsAmountChip(platformKey, type, data)) {
      pieces.push(String(amount));
    }
    if (count && !supportsCountChip(platformKey, type, data)) {
      pieces.push(`x${count}`);
    }
    if (note && note !== amount) {
      pieces.push(note);
    }

    return pieces.join(" ").trim();
  }

  function extractSupportAmount(platformKey, type, data) {
    if (isKickGiftItemEvent(platformKey, type, data) || isKickDirectKicksEvent(platformKey, type, data)) {
      const amount = extractKickGiftAmount(data);
      return amount !== null ? formatPlainNumber(amount) : "";
    }

    if (!isSpecialEvent(platformKey, type)) {
      return "";
    }

    if (platformKey === "twitch" && (type === "Cheer" || type === "CoinCheer")) {
      const bits = pickFirstNumber(data, ["bits", "cheerAmount", "amount", "coins"]);
      return bits !== null ? formatUnitAmount(bits, "BIT", "BITS") : "";
    }

    if (platformKey === "twitch" && type === "GiftBomb") {
      const total = resolveMassGiftCount(data);
      return total !== null && total > 1 ? formatUnitAmount(total, "SUB", "SUBS") : "";
    }

    if (platformKey === "kick" && (type === "MassGiftSubscription" || type === "sGifted")) {
      const total = resolveMassGiftCount(data);
      return total !== null && total > 1 ? formatUnitAmount(total, "SUB", "SUBS") : "";
    }

    const direct = pickFirstString(data, [
      "formattedAmount",
      "amountFormatted",
      "amountDisplayString",
      "displayAmount",
      "tipFormattedAmount",
    ]);
    if (direct) {
      return direct;
    }

    if (platformKey === "youtube") {
      const explicitAmount = getValueByPath(data, "amount");
      if (typeof explicitAmount === "string" && explicitAmount.trim()) {
        return explicitAmount.trim();
      }

      const microAmount = pickFirstNumber(data, ["microAmount"]);
      const currencyCode = pickFirstString(data, ["currencyCode"]);
      if (microAmount !== null) {
        return formatCurrencyAmount(microAmount / 1000000, currencyCode);
      }
    }

    const numericAmount = pickFirstNumber(data, ["tipAmount", "amount"]);
    const currencyCode = pickFirstString(data, ["tipCurrency", "currencyCode", "currency"]);
    if (numericAmount !== null) {
      return formatCurrencyAmount(numericAmount, currencyCode);
    }

    return "";
  }

  function supportsAmountChip(platformKey, type, data) {
    return [
      "youtube.SuperChat",
      "youtube.SuperSticker",
      "streamlabs.Merchandise",
      "streamlabs.Donation",
      "streamelements.Tip",
      "kofi.Donation",
      "fourthwall.Donation",
      "twitch.CharityDonation",
      "twitch.Cheer",
      "twitch.CoinCheer",
      "twitch.GiftBomb",
      "kick.MassGiftSubscription",
      "kick.sGifted",
      "kick.KicksGifted",
    ].includes(`${platformKey}.${type}`) || isKickGiftItemEvent(platformKey, type, data);
  }

  function supportsCountChip(platformKey, type, data) {
    return [
      "twitch.GiftBomb",
      "kick.MassGiftSubscription",
      "kick.sGifted",
    ].includes(`${platformKey}.${type}`) || isKickGiftItemEvent(platformKey, type, data);
  }

  function getSpecialTone(platformKey, type, data) {
    if (platformKey === "kick" && isKickGiftItemEvent(platformKey, type, data)) {
      return "tone-kick-gift";
    }

    if (platformKey === "kick" && isKickDirectKicksEvent(platformKey, type, data)) {
      return "tone-kick-kicks";
    }

    switch (`${platformKey}.${type}`) {
      case "twitch.Follow":
        return "tone-follow-twitch";
      case "kick.Follow":
        return "tone-follow-kick";
      case "youtube.NewSubscriber":
        return "tone-follow-youtube";
      case "twitch.Raid":
        return "tone-raid-twitch";
      case "kick.Raid":
        return "tone-raid-kick";
      case "twitch.HypeTrainStart":
      case "twitch.HypeTrainUpdate":
      case "twitch.HypeTrainLevelUp":
      case "twitch.HypeTrainEnd":
        return "tone-hypetrain-twitch";
      case "twitch.RewardRedemption":
        return "tone-redeem-twitch";
      case "kick.RewardRedemption":
        return "tone-redeem-kick";
      case "streamlabs.Merchandise":
        return "tone-redeem-streamlabs";
      case "kick.Subscription":
      case "kick.Resubscription":
        return "tone-kick-supporter";
      case "twitch.Sub":
      case "twitch.ReSub":
        return "tone-twitch-supporter";
      case "youtube.SuperChat":
      case "youtube.SuperSticker":
        return getYouTubePaidTone(data);
      case "youtube.NewSponsor":
        return "tone-youtube-supporter";
      case "youtube.MembershipGift":
        return "tone-youtube-red";
      case "youtube.GiftMembershipReceived":
        return "tone-youtube-green";
      case "streamlabs.Donation":
      case "streamelements.Tip":
      case "kofi.Donation":
      case "fourthwall.Donation":
      case "twitch.CharityDonation":
        return getTipTone(data);
      default:
        return "";
    }
  }

  function getTipTone(data) {
    const amount = extractNumericMonetaryValue(data);
    if (amount === null) {
      return "tone-tip-blue";
    }

    if (amount < 3) {
      return "tone-tip-blue";
    }
    if (amount < 5) {
      return "tone-tip-cyan";
    }
    if (amount < 10) {
      return "tone-tip-green";
    }
    if (amount < 20) {
      return "tone-tip-yellow";
    }
    if (amount < 50) {
      return "tone-tip-orange";
    }
    if (amount < 100) {
      return "tone-tip-magenta";
    }
    return "tone-tip-red";
  }

  function extractNumericMonetaryValue(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    const directNumber = pickFirstNumber(data, ["tipAmount", "amount"]);
    if (directNumber !== null) {
      return directNumber;
    }

    const microAmount = pickFirstNumber(data, ["microAmount"]);
    if (microAmount !== null) {
      return microAmount / 1000000;
    }

    const textAmount = pickFirstString(data, [
      "formattedAmount",
      "amountFormatted",
      "amountDisplayString",
      "displayAmount",
      "tipFormattedAmount",
      "amount",
    ]);
    if (!textAmount) {
      return null;
    }

    const normalized = textAmount.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function shouldUsePaidEntryEffect(platformKey, type, data) {
    if (platformKey === "kick" && isKickGiftItemEvent(platformKey, type, data)) {
      return true;
    }

    return [
      "youtube.SuperChat",
      "youtube.SuperSticker",
      "youtube.NewSponsor",
      "youtube.MembershipGift",
      "youtube.GiftMembershipReceived",
      "kick.Subscription",
      "kick.Resubscription",
      "kick.GiftSubscription",
      "kick.MassGiftSubscription",
      "kick.sGifted",
      "kick.KicksGifted",
      "twitch.Cheer",
      "twitch.CoinCheer",
      "twitch.Sub",
      "twitch.ReSub",
      "twitch.GiftSub",
      "twitch.GiftBomb",
      "twitch.CharityDonation",
      "twitch.HypeTrainStart",
      "twitch.HypeTrainUpdate",
      "twitch.HypeTrainLevelUp",
      "twitch.HypeTrainEnd",
      "streamlabs.Merchandise",
      "streamlabs.Donation",
      "streamelements.Tip",
      "kofi.Donation",
      "kofi.Subscription",
      "kofi.Resubscription",
      "fourthwall.Donation",
      "fourthwall.SubscriptionPurchased",
      "fourthwall.GiftPurchase",
    ].includes(`${platformKey}.${type}`);
  }

  function isFollowAlertItem(item) {
    if (!item || item.variant !== "special") {
      return false;
    }

    return item.tone === "tone-follow-twitch" ||
      item.tone === "tone-follow-kick" ||
      item.tone === "tone-follow-youtube";
  }

  function isTipTone(tone) {
    return typeof tone === "string" && tone.startsWith("tone-tip");
  }

  function getYouTubePaidTone(data) {
    const tier = pickFirstNumber(data, ["tier"]);
    if (tier !== null) {
      if (tier <= 1) {
        return "tone-youtube-blue";
      }
      if (tier === 2) {
        return "tone-youtube-cyan";
      }
      if (tier === 3) {
        return "tone-youtube-green";
      }
      if (tier === 4) {
        return "tone-youtube-yellow";
      }
      if (tier === 5) {
        return "tone-youtube-orange";
      }
      if (tier === 6) {
        return "tone-youtube-magenta";
      }
      return "tone-youtube-red";
    }

    const microAmount = pickFirstNumber(data, ["microAmount"]);
    if (microAmount !== null) {
      if (microAmount < 2000000) {
        return "tone-youtube-blue";
      }
      if (microAmount < 5000000) {
        return "tone-youtube-cyan";
      }
      if (microAmount < 10000000) {
        return "tone-youtube-green";
      }
      if (microAmount < 20000000) {
        return "tone-youtube-yellow";
      }
      if (microAmount < 50000000) {
        return "tone-youtube-orange";
      }
      if (microAmount < 100000000) {
        return "tone-youtube-magenta";
      }
      return "tone-youtube-red";
    }

    return "tone-youtube-blue";
  }

  function formatCurrencyAmount(amount, currencyCode) {
    if (!Number.isFinite(amount)) {
      return "";
    }

    if (currencyCode) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch (error) {
        // Fall through to a simpler format if the currency code is not recognized.
      }
    }

    const formattedAmount = amount % 1 === 0 ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
    return currencyCode ? `${formattedAmount} ${currencyCode}` : formattedAmount;
  }

  function formatUnitAmount(amount, singularLabel, pluralLabel) {
    if (!Number.isFinite(amount)) {
      return "";
    }
    const normalized = Math.max(0, Number(amount));
    const formattedAmount = normalized % 1 === 0
      ? Math.round(normalized).toLocaleString()
      : normalized.toFixed(2).replace(/\.?0+$/, "");
    const label = normalized === 1 ? singularLabel : pluralLabel;
    return `${formattedAmount} ${label}`;
  }

  function formatPlainNumber(amount) {
    if (!Number.isFinite(amount)) {
      return "";
    }

    const normalized = Math.max(0, Number(amount));
    return normalized % 1 === 0
      ? Math.round(normalized).toLocaleString()
      : normalized.toFixed(2).replace(/\.?0+$/, "");
  }

  function extractKickGiftMeta(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    const directImageUrl = pickFirstString(data, [
      "giftImageUrl",
      "gift.imageUrl",
      "gift.image.url",
      "giftUrl",
      "gift.url",
      "assetUrl",
      "imageUrl",
    ]);
    const directGiftId = pickFirstString(data, [
      "giftId",
      "gift.id",
      "gift.slug",
      "gift.key",
      "lastGiftId",
    ]);
    const directGiftName = pickFirstString(data, [
      "giftName",
      "gift.name",
      "gift.title",
      "lastGiftName",
    ]);
    const amount = extractKickGiftAmount(data);
    const catalogEntry = directGiftId
      ? findKickGiftById(directGiftId)
      : findKickGiftByName(directGiftName);

    const giftId = directGiftId || (catalogEntry && catalogEntry.id) || "";
    const giftName = directGiftName || (catalogEntry && catalogEntry.name) || "";
    const imageUrl = directImageUrl || buildKickGiftImageUrl(giftId);

    if (!giftId && !giftName && !imageUrl) {
      return null;
    }

    return {
      id: giftId,
      name: giftName,
      imageUrl,
      amount,
    };
  }

  function extractYouTubeSuperStickerMeta(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    const stickerId = pickFirstString(data, [
      "stickerId",
      "sticker.id",
      "sticker.stickerId",
      "superSticker.id",
      "superStickerMetadata.stickerId",
      "superSticker.stickerId",
      "snippet.superStickerDetails.superStickerMetadata.stickerId",
      "message.superStickerDetails.superStickerMetadata.stickerId",
    ]);
    const title = pickFirstString(data, [
      "altText",
      "stickerAltText",
      "sticker.altText",
      "sticker.title",
      "sticker.name",
      "superStickerMetadata.altText",
      "superSticker.altText",
      "snippet.superStickerDetails.superStickerMetadata.altText",
      "message.superStickerDetails.superStickerMetadata.altText",
      "name",
      "title",
    ]) || "Super Sticker";
    const directImageUrl = pickFirstString(data, [
      "imageUrl",
      "stickerUrl",
      "stickerImageUrl",
      "sticker.imageUrl",
      "sticker.image.url",
      "stickerImage.url",
      "image.url",
      "superStickerMetadata.imageUrl",
      "superSticker.imageUrl",
      "snippet.superStickerDetails.superStickerMetadata.imageUrl",
      "message.superStickerDetails.superStickerMetadata.imageUrl",
    ]);

    if (!stickerId && !directImageUrl) {
      return null;
    }

    return {
      id: stickerId || "",
      title,
      imageUrl: directImageUrl || resolveYouTubeSuperStickerImageUrl(stickerId),
    };
  }

  function normalizeStickerLookupKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function resolveYouTubeSuperStickerImageUrl(stickerId) {
    const normalized = normalizeStickerLookupKey(stickerId);
    if (!normalized) {
      return "";
    }

    if (!state.youtubeStickerMap) {
      void ensureYouTubeSuperStickerMap();
      return "";
    }

    return state.youtubeStickerMap[normalized] || "";
  }

  async function ensureYouTubeSuperStickerMap() {
    if (state.youtubeStickerMap) {
      return state.youtubeStickerMap;
    }

    if (state.youtubeStickerMapPromise) {
      return state.youtubeStickerMapPromise;
    }

    const now = Date.now();
    if (now - state.youtubeStickerMapLastAttemptAt < 15000) {
      return null;
    }

    state.youtubeStickerMapLastAttemptAt = now;
    state.youtubeStickerMapPromise = fetch(YOUTUBE_SUPER_STICKER_MAP_PATH, {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Sticker map fetch failed with ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload || typeof payload !== "object") {
          throw new Error("Sticker map payload was invalid");
        }

        const map = {};
        for (const [rawKey, rawValue] of Object.entries(payload)) {
          const key = normalizeStickerLookupKey(rawKey);
          const value = typeof rawValue === "string" ? rawValue.trim() : "";
          if (!key || !value) {
            continue;
          }
          map[key] = value;
        }

        state.youtubeStickerMap = map;
        renderFeed();
        return map;
      })
      .catch((error) => {
        console.warn("Failed to load YouTube Super Sticker map.", error);
        return null;
      })
      .finally(() => {
        state.youtubeStickerMapPromise = null;
      });

    return state.youtubeStickerMapPromise;
  }

  function extractKickGiftAmount(data) {
    return pickFirstNumber(data, [
      "kicks.amount",
      "kicks",
      "giftAmount",
      "gift_amount",
      "giftValue",
      "gift.value",
      "amount",
      "qty",
      "quantity",
      "count",
    ]);
  }

  function buildKickGiftImageUrl(giftId) {
    const id = String(giftId || "").trim();
    if (!id) {
      return "";
    }
    return `https://files.kick.com/kicks/gifts/${encodeURIComponent(id)}.webp`;
  }

  function normalizeKickGiftLookupKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function findKickGiftByAmount(amount, options = {}) {
    if (!Number.isFinite(amount)) {
      return null;
    }

    const normalizedAmount = Number(amount);
    if (KICK_GIFT_CATALOG[normalizedAmount]) {
      return KICK_GIFT_CATALOG[normalizedAmount];
    }

    if (!options.allowBestFit) {
      return null;
    }

    const knownAmounts = Object.keys(KICK_GIFT_CATALOG).map(Number).sort((left, right) => right - left);
    for (const knownAmount of knownAmounts) {
      if (normalizedAmount >= knownAmount) {
        return KICK_GIFT_CATALOG[knownAmount];
      }
    }

    return null;
  }

  function findKickGiftById(giftId) {
    const normalizedId = normalizeKickGiftLookupKey(giftId);
    if (!normalizedId) {
      return null;
    }

    return Object.values(KICK_GIFT_CATALOG).find((entry) => normalizeKickGiftLookupKey(entry.id) === normalizedId) || null;
  }

  function findKickGiftByName(giftName) {
    const normalizedName = normalizeKickGiftLookupKey(giftName);
    if (!normalizedName) {
      return null;
    }

    return Object.values(KICK_GIFT_CATALOG).find((entry) =>
      normalizeKickGiftLookupKey(entry.name) === normalizedName ||
      normalizeKickGiftLookupKey(entry.id) === normalizedName
    ) || null;
  }

  function getKickGiftCatalogAmount(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    for (const [rawAmount, knownEntry] of Object.entries(KICK_GIFT_CATALOG)) {
      if (knownEntry === entry) {
        const amount = Number(rawAmount);
        return Number.isFinite(amount) ? amount : null;
      }
    }

    return null;
  }

  function formatBadgeLabel(type) {
    return type.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function pickFirstString(obj, paths) {
    for (const path of paths) {
      const value = getValueByPath(obj, path);
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  function pickFirstNumber(obj, paths) {
    for (const path of paths) {
      const value = getValueByPath(obj, path);
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }
    return null;
  }

  function tryParsePositiveWhole(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const rounded = Math.round(value);
      return rounded > 0 ? rounded : null;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const direct = Number.parseInt(text, 10);
    if (Number.isFinite(direct) && direct > 0 && String(direct) === text.replace(/^\+/, "")) {
      return direct;
    }

    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      return rounded > 0 ? rounded : null;
    }

    return null;
  }

  function countRecipientList(data) {
    if (!data || typeof data !== "object") {
      return 0;
    }

    const recipients = getValueByPath(data, "recipients");
    if (Array.isArray(recipients)) {
      return recipients.length;
    }

    return 0;
  }

  function countIndexedRecipients(data) {
    if (!data || typeof data !== "object") {
      return 0;
    }

    const indexes = new Set();
    for (const key of Object.keys(data)) {
      if (typeof key !== "string" || !key.toLowerCase().startsWith("recipient.")) {
        continue;
      }

      const parts = key.split(".");
      if (parts.length < 3) {
        continue;
      }

      const indexValue = Number.parseInt(parts[1], 10);
      if (Number.isFinite(indexValue) && indexValue >= 0) {
        indexes.add(indexValue);
      }
    }

    return indexes.size;
  }

  function resolveMassGiftCount(data) {
    const keys = [
      "subBombCount",
      "sub_gift_count",
      "gift_amount",
      "amount",
      "qty",
      "count",
      "subscription.count",
      "gifts.count",
      "gift_count",
      "gifted_count",
      "subscriptions",
      "subs",
      "sub_count",
      "total_gifts",
      "gifted",
      "quantity",
      "totalGifted",
      "totalSubsGifted",
    ];

    for (const key of keys) {
      const parsed = tryParsePositiveWhole(getValueByPath(data, key));
      if (parsed !== null) {
        return parsed;
      }
    }

    const recipientListCount = countRecipientList(data);
    if (recipientListCount > 0) {
      return recipientListCount;
    }

    const indexedRecipientCount = countIndexedRecipients(data);
    if (indexedRecipientCount > 0) {
      return indexedRecipientCount;
    }

    return 1;
  }

  function pickFirstBoolean(obj, paths) {
    for (const path of paths) {
      const value = getValueByPath(obj, path);
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
          return true;
        }
        if (normalized === "false") {
          return false;
        }
      }
      if (typeof value === "number") {
        if (value === 1) {
          return true;
        }
        if (value === 0) {
          return false;
        }
      }
    }

    return false;
  }

  function getValueByPath(obj, path) {
    return path.split(".").reduce((value, key) => {
      if (value && Object.prototype.hasOwnProperty.call(value, key)) {
        return value[key];
      }
      return undefined;
    }, obj);
  }

  function extractBadgeNames(badges) {
    if (!Array.isArray(badges)) {
      return [];
    }

    return badges
      .map((badge) => {
        if (!badge) {
          return "";
        }
        if (typeof badge === "string") {
          return badge;
        }
        return badge.name ||
          badge.label ||
          badge.title ||
          badge.text ||
          badge.tooltip ||
          badge.displayName ||
          badge.type ||
          badge.kind ||
          badge.info ||
          badge.version ||
          "";
      })
      .filter((badge) => {
        if (!badge) {
          return false;
        }
        return String(badge).trim().toLowerCase() !== "broadcaster";
      })
      .slice(0, 4);
  }

  function extractYouTubeBadgeNames(data) {
    const badges = extractBadgeNames(
      getValueByPath(data, "author.badges") ||
      getValueByPath(data, "user.badges") ||
      getValueByPath(data, "authorDetails.authorBadges") ||
      getValueByPath(data, "snippet.authorDetails.authorBadges") ||
      getValueByPath(data, "message.authorDetails.authorBadges") ||
      getValueByPath(data, "badges"),
    );

    if (pickFirstBoolean(data, ["author.isChatModerator", "authorDetails.isChatModerator", "snippet.authorDetails.isChatModerator", "message.authorDetails.isChatModerator", "user.isModerator", "isModerator"])
      && !badges.some((badge) => isModeratorBadge(String(badge || "").trim().toLowerCase()))) {
      badges.push("Moderator");
    }

    if (pickFirstBoolean(data, ["author.isVerified", "authorDetails.isVerified", "snippet.authorDetails.isVerified", "message.authorDetails.isVerified", "user.isVerified", "isVerified"])
      && !badges.some((badge) => isVerifiedBadge(String(badge || "").trim().toLowerCase()))) {
      badges.push("Verified Channel");
    }

    if (pickFirstBoolean(data, [
      "author.isChatSponsor",
      "author.isSponsor",
      "authorDetails.isChatSponsor",
      "authorDetails.isSponsor",
      "snippet.authorDetails.isChatSponsor",
      "snippet.authorDetails.isSponsor",
      "message.authorDetails.isChatSponsor",
      "message.authorDetails.isSponsor",
      "user.isMember",
      "user.isSponsor",
      "user.isChatSponsor",
      "isMember",
      "isSponsor",
      "isChatSponsor",
      "isSubscriber",
    ]) && !badges.some((badge) => isMemberBadge(String(badge || "").trim().toLowerCase()))) {
      badges.push("Member");
    }

    return badges.slice(0, 4);
  }

  function joinTextParts(parts) {
    if (!Array.isArray(parts)) {
      return "";
    }

    return parts.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("").trim();
  }

  function extractMessageContentParts(platformKey, data, fallbackText) {
    const fromParts = normalizeStructuredParts(platformKey, data && data.parts);
    if (fromParts.length) {
      return fromParts;
    }

    const fromEmotes = buildPartsFromEmoteRanges(
      String(fallbackText || ""),
      Array.isArray(data && data.emotes) ? data.emotes : [],
      platformKey,
    );
    if (fromEmotes.length) {
      return fromEmotes;
    }

    return normalizePlaceholderText(platformKey, fallbackText);
  }

  function normalizeStructuredParts(platformKey, parts) {
    if (!Array.isArray(parts) || !parts.length) {
      return [];
    }

    const normalized = [];
    for (const part of parts) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const imageUrl = extractPartImageUrl(platformKey, part);
      const text = extractPartText(part);
      if (imageUrl) {
        normalized.push({
          type: "emote",
          imageUrl,
          text: text || extractPartName(part) || "",
        });
        continue;
      }

      if (text) {
        normalized.push({
          type: "text",
          text,
        });
      }
    }

    return compactContentParts(normalized);
  }

  function buildPartsFromEmoteRanges(text, emotes, platformKey) {
    if (!text || !Array.isArray(emotes) || !emotes.length) {
      return [];
    }

    const ranges = emotes
      .map((emote) => {
        if (!emote || typeof emote !== "object") {
          return null;
        }

        const start = pickFirstNumber(emote, ["startIndex", "start", "begin", "position"]);
        const end = pickFirstNumber(emote, ["endIndex", "end", "stop"]);
        const imageUrl = extractPartImageUrl(platformKey, emote);
        if (!imageUrl || !Number.isFinite(start) || !Number.isFinite(end)) {
          return null;
        }

        return {
          start: Math.max(0, Math.trunc(start)),
          end: Math.max(Math.trunc(start), Math.trunc(end)),
          imageUrl,
          text: extractPartText(emote) || extractPartName(emote) || "",
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.start - right.start);

    if (!ranges.length) {
      return [];
    }

    const normalized = [];
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        normalized.push({
          type: "text",
          text: text.slice(cursor, range.start),
        });
      }

      normalized.push({
        type: "emote",
        imageUrl: range.imageUrl,
        text: range.text || text.slice(range.start, range.end + 1),
      });
      cursor = Math.max(cursor, range.end + 1);
    }

    if (cursor < text.length) {
      normalized.push({
        type: "text",
        text: text.slice(cursor),
      });
    }

    return compactContentParts(normalized);
  }

  function normalizePlaceholderText(platformKey, text) {
    const value = String(text || "");
    if (!value) {
      return [];
    }

    const pattern = /\[emote:(\d+):([^\]]+)\]/g;
    const normalized = [];
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      if (match.index > cursor) {
        normalized.push({
          type: "text",
          text: value.slice(cursor, match.index),
        });
      }

      const imageUrl = buildEmoteUrlFromId(platformKey, match[1]);
      if (imageUrl) {
        normalized.push({
          type: "emote",
          imageUrl,
          text: match[2] || "emote",
        });
      } else {
        normalized.push({
          type: "text",
          text: match[0],
        });
      }
      cursor = match.index + match[0].length;
    }

    if (cursor < value.length) {
      normalized.push({
        type: "text",
        text: value.slice(cursor),
      });
    }

    return compactContentParts(normalized);
  }

  function compactContentParts(parts) {
    if (!Array.isArray(parts) || !parts.length) {
      return [];
    }

    const compacted = [];
    for (const part of parts) {
      if (!part) {
        continue;
      }

      if (part.type === "emote" && part.imageUrl) {
        compacted.push({
          type: "emote",
          imageUrl: part.imageUrl,
          text: String(part.text || "").trim(),
        });
        continue;
      }

      const text = String(part.text || "");
      if (!text) {
        continue;
      }

      const previous = compacted[compacted.length - 1];
      if (previous && previous.type === "text") {
        previous.text += text;
      } else {
        compacted.push({
          type: "text",
          text,
        });
      }
    }

    return compacted;
  }

  function extractPartImageUrl(platformKey, part) {
    const direct = pickFirstString(part, [
      "image",
      "imageUrl",
      "url",
      "image.url",
      "emoji.image",
      "emoji.imageUrl",
      "urls.4x",
      "urls.3x",
      "urls.2x",
      "urls.1x",
      "emote.imageUrl",
      "emote.url",
      "emote.urls.4x",
      "emote.urls.3x",
      "emote.urls.2x",
      "emote.urls.1x",
      "images.large",
      "images.medium",
      "images.small",
      "src",
    ]);
    if (direct) {
      return direct;
    }

    const emoteId = pickFirstString(part, ["id", "emoteId", "emote.id"]);
    if (emoteId) {
      return buildEmoteUrlFromId(platformKey, emoteId);
    }

    return "";
  }

  function extractPartText(part) {
    return pickFirstString(part, [
      "text",
      "name",
      "emote.name",
      "displayName",
      "code",
      "value",
    ]);
  }

  function extractPartName(part) {
    return pickFirstString(part, [
      "name",
      "emote.name",
      "displayName",
      "code",
    ]);
  }

  function buildEmoteUrlFromId(platformKey, emoteId) {
    const id = String(emoteId || "").trim();
    if (!id) {
      return "";
    }

    if (platformKey === "kick") {
      return `https://files.kick.com/emotes/${encodeURIComponent(id)}/fullsize`;
    }

    if (platformKey === "twitch") {
      return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/3.0`;
    }

    return "";
  }

  function objectSummary(data) {
    const keys = Object.keys(data || {}).slice(0, 4);
    return keys.length ? `Received ${keys.join(", ")} data.` : "[event received]";
  }

  function extractAvatarUrl(platformKey, data) {
    const direct = pickFirstString(data, [
      "user.profilePicture",
      "user.profileImageUrl",
      "user.profileImage",
      "user.avatarUrl",
      "user.imageUrl",
      "author.photo",
      "author.photo.url",
      "authorPhoto",
      "authorPhotoUrl",
      "profileImageUrl",
      "profilePicture",
      "avatarUrl",
      "tipAvatar",
      "photo",
      "snippet.authorProfileImageUrl",
      "thumbnail.url",
    ]);

    if (direct) {
      return direct;
    }

    if (platformKey === "streamelements") {
      return LUCIDPAY_STATUS_ICON;
    }

    if (isBroadcasterMessage(platformKey, data)) {
      return getBroadcasterAvatar(platformKey);
    }

    return "";
  }

  function extractMessageId(platformKey, data) {
    if (!data || typeof data !== "object") {
      return "";
    }

    const commonId = pickFirstString(data, [
      "messageId",
      "id",
      "message.id",
      "data.messageId",
      "snippet.messageId",
    ]);
    if (commonId) {
      return commonId;
    }

    if (platformKey === "twitch") {
      return pickFirstString(data, [
        "message.msgId",
        "message.messageId",
        "info.messageId",
      ]);
    }

    if (platformKey === "youtube") {
      return pickFirstString(data, [
        "snippet.id",
        "message.messageId",
        "resourceId",
      ]);
    }

    return "";
  }

  function extractUserId(platformKey, data) {
    if (!data || typeof data !== "object") {
      return "";
    }

    const commonId = pickFirstString(data, [
      "userId",
      "user.id",
      "author.id",
      "author.channelId",
      "channelId",
      "message.userId",
      "sender.id",
    ]);
    if (commonId) {
      return commonId;
    }

    if (platformKey === "twitch") {
      return pickFirstString(data, ["message.userId", "message.senderUserId", "meta.userId"]);
    }

    if (platformKey === "youtube") {
      return pickFirstString(data, ["snippet.authorChannelId", "author.channelId", "resourceId"]);
    }

    return "";
  }

  function getBroadcasterAvatar(platformKey) {
    const override = config.broadcasterAvatarOverrides[platformKey];
    if (override) {
      return override;
    }

    const fromHistory = findLatestBroadcasterAvatar(platformKey);
    if (fromHistory) {
      return fromHistory;
    }

    const info = state.broadcasters[platformKey] || {};
    return (
      info.broadcastUserProfileImage ||
      info.broadcasterProfileUrl ||
      info.profilePicture ||
      ""
    );
  }

  function findLatestBroadcasterAvatar(platformKey) {
    for (let index = state.feedItems.length - 1; index >= 0; index -= 1) {
      const item = state.feedItems[index];
      if (
        item &&
        item.platform === platformKey &&
        item.isBroadcaster &&
        typeof item.avatarUrl === "string" &&
        item.avatarUrl.trim()
      ) {
        return item.avatarUrl.trim();
      }
    }

    return "";
  }

  function isBroadcasterMessage(platformKey, data) {
    const info = state.broadcasters[platformKey] || {};
    const ids = [
      info.broadcastUserId,
      info.broadcasterUserId,
    ].filter(Boolean).map(String);
    const names = [
      info.broadcastUser,
      info.broadcastUserName,
      info.broadcasterLogin,
      info.broadcasterUserName,
    ].filter(Boolean).map((value) => String(value).toLowerCase());

    const userId = pickFirstString(data, ["user.id", "author.id", "userId", "channelId"]);
    const login = pickFirstString(data, ["user.login", "user.name", "author.name", "displayName", "authorDisplayName", "snippet.authorDisplayName"]).toLowerCase();
    const roleValue = getValueByPath(data, "user.role");
    const typeValue = pickFirstString(data, ["user.type"]).toLowerCase();

    if (userId && ids.includes(String(userId))) {
      return true;
    }
    if (login && names.includes(login)) {
      return true;
    }
    if (roleValue === 4 || String(roleValue).toLowerCase() === "broadcaster") {
      return true;
    }
    if (typeValue === "broadcaster") {
      return true;
    }
    return false;
  }

  function pushChatMessage(message) {
    const isVisibleMessage = shouldDisplayMessage(message);
    const shouldTrim = config.maxMessages > 0 && state.feedItems.length + 1 > config.maxMessages;
    state.feedItems.push(message);
    if (shouldTrim) {
      state.feedItems.splice(0, state.feedItems.length - config.maxMessages);
    }
    if (isVisibleMessage && state.scrollPaused) {
      state.pausedNewCount += 1;
    }
    persistFeed();
    if (!isVisibleMessage) {
      return;
    }
    if (shouldTrim) {
      renderFeed();
    } else {
      appendMessageToFeed(message);
    }
    maybeAutoScroll();
  }

  function renderSupportTrainHud() {
    if (!ui.supportTrainHud) {
      return;
    }

    if (!config.trainOnly) {
      ui.supportTrainHud.classList.add("hidden");
      return;
    }

    const train = state.supportTrain;
    if (!train || !train.active || train.expiresAt <= Date.now()) {
      ui.supportTrainHud.classList.add("hidden");
      ui.supportTrainHud.classList.remove(
        "theme-kick",
        "theme-twitch",
        "theme-youtube",
        "theme-streamlabs",
        "theme-streamelements"
      );
      return;
    }

    const platform = getSupportTrainThemePlatform(train.dominantPlatform);
    const meta = PLATFORM_META[platform] || PLATFORM_META.kick;
    const trainLabel = getSupportTrainDisplayLabel(platform);
    const remainingMs = Math.max(0, train.expiresAt - Date.now());
    const nextThreshold = SUPPORT_TRAIN_LEVEL_THRESHOLDS[train.level];
    const currentFloor = train.level > 0 ? SUPPORT_TRAIN_LEVEL_THRESHOLDS[train.level - 1] : 0;
    const segment = nextThreshold ? Math.max(1, nextThreshold - currentFloor) : Math.max(1, train.totalPoints);
    const fillRatio = nextThreshold
      ? Math.max(0, Math.min(1, (train.totalPoints - currentFloor) / segment))
      : 1;

    ui.supportTrainHud.classList.remove("hidden");
    ui.supportTrainHud.classList.remove(
      "theme-kick",
      "theme-twitch",
      "theme-youtube",
      "theme-streamlabs",
      "theme-streamelements",
      "is-urgent",
      "is-critical"
    );
    ui.supportTrainHud.classList.add(`theme-${platform}`);
    if (remainingMs <= 8000) {
      ui.supportTrainHud.classList.add("is-critical");
    } else if (remainingMs <= 18000) {
      ui.supportTrainHud.classList.add("is-urgent");
    }
    if (ui.supportTrainBadge) {
      ui.supportTrainBadge.textContent = "Train Active";
    }
    if (ui.supportTrainIcon) {
      if (ui.supportTrainIcon.dataset.platform !== platform) {
        ui.supportTrainIcon.innerHTML = statusPlatformIconSvg(platform);
        ui.supportTrainIcon.dataset.platform = platform;
      }
    }
    if (ui.supportTrainTitle) {
      ui.supportTrainTitle.textContent = `${trainLabel} Support Train`;
    }
    if (ui.supportTrainSubtitle) {
      ui.supportTrainSubtitle.textContent = nextThreshold
        ? `${getSupportTrainProgressText(train)} until level ${train.level + 1}`
        : "Max level locked in";
    }
    if (ui.supportTrainLevel) {
      ui.supportTrainLevel.textContent = String(Math.max(1, train.level));
    }
    if (ui.supportTrainTime) {
      ui.supportTrainTime.textContent = formatDurationClock(remainingMs);
    }
    if (ui.supportTrainBarFill) {
      ui.supportTrainBarFill.style.width = `${Math.round(fillRatio * 100)}%`;
    }
    if (ui.supportTrainPoints) {
      ui.supportTrainPoints.textContent = `${formatPlainNumber(train.totalPoints)} pts`;
    }
    if (ui.supportTrainLatest) {
      const parts = [];
      if (train.lastContributor) {
        parts.push(train.lastContributor);
      }
      if (train.lastContributionLabel) {
        parts.push(train.lastContributionLabel);
      }
      ui.supportTrainLatest.textContent = parts.length
        ? `Latest: ${parts.join(" | ")}`
        : "Latest: waiting for the next support spike";
    }
  }

  function triggerSupportTrainHudBurst(kind = "step") {
    if (!ui.supportTrainHud) {
      return;
    }

    ui.supportTrainHud.classList.remove("is-bursting", "is-levelup");
    void ui.supportTrainHud.offsetWidth;
    ui.supportTrainHud.classList.add("is-bursting");
    if (kind === "levelup" || kind === "start") {
      ui.supportTrainHud.classList.add("is-levelup");
    }
    window.setTimeout(() => {
      if (!ui.supportTrainHud) {
        return;
      }
      ui.supportTrainHud.classList.remove("is-bursting", "is-levelup");
    }, 700);
  }

  function processSupportTrainEvent(platformKey, type, data, message) {
    const contribution = getSupportTrainContribution(platformKey, type, data, message);
    if (!contribution) {
      return;
    }

    const train = state.supportTrain || createSupportTrainState();
    state.supportTrain = train;
    const now = Date.now();
    const wasActive = train.active && train.expiresAt > now;
    const hadDormantProgress = !wasActive && Number.isFinite(train.expiresAt) && train.expiresAt > now && Number.isFinite(train.totalPoints) && train.totalPoints > 0;

    if (!wasActive && !hadDormantProgress && train.totalPoints > 0) {
      resetSupportTrain(train);
    }

    if (!wasActive) {
      train.totalPoints = (Number.isFinite(train.totalPoints) ? train.totalPoints : 0) + contribution.points;
      train.eventCount = (Number.isFinite(train.eventCount) ? train.eventCount : 0) + 1;
      train.platformPoints[contribution.platform] = (train.platformPoints[contribution.platform] || 0) + contribution.points;
      train.dominantPlatform = getSupportTrainDominantPlatform(train.platformPoints, contribution.platform);
      train.lastContributor = contribution.username || "";
      train.lastContributionLabel = contribution.label || "";
      train.expiresAt = now + SUPPORT_TRAIN_WINDOW_MS;

      if (train.totalPoints < SUPPORT_TRAIN_TRIGGER_POINTS) {
        return;
      }

      train.active = true;
    } else {
      train.totalPoints += contribution.points;
      train.eventCount += 1;
      train.platformPoints[contribution.platform] = (train.platformPoints[contribution.platform] || 0) + contribution.points;
      train.dominantPlatform = getSupportTrainDominantPlatform(train.platformPoints, contribution.platform);
      train.lastContributor = contribution.username || "";
      train.lastContributionLabel = contribution.label || "";
      train.expiresAt = now + SUPPORT_TRAIN_WINDOW_MS;
    }

    const previousLevel = train.level;
    train.level = getSupportTrainLevel(train.totalPoints);
    scheduleSupportTrainEnd(train);

    if (!wasActive) {
      emitSupportTrainAlert("start", train, contribution);
    }

    renderSupportTrainHud();
    persistSupportTrain();
  }

  function resetSupportTrain(train) {
    if (!train) {
      return;
    }

    if (train.endTimer) {
      window.clearTimeout(train.endTimer);
    }

    train.active = false;
    train.totalPoints = 0;
    train.level = 0;
    train.dominantPlatform = "kick";
    train.platformPoints = {};
    train.eventCount = 0;
    train.lastContributor = "";
    train.lastContributionLabel = "";
    train.expiresAt = 0;
    train.endTimer = 0;
    train.lastSyntheticId = "";
    renderSupportTrainHud();
    persistSupportTrain();
  }

  function scheduleSupportTrainEnd(train) {
    if (!train) {
      return;
    }

    if (train.endTimer) {
      window.clearTimeout(train.endTimer);
    }

    const delay = Math.max(1000, train.expiresAt - Date.now());
    train.endTimer = window.setTimeout(() => {
      const activeTrain = state.supportTrain;
      if (!activeTrain || !activeTrain.active) {
        return;
      }

      if (activeTrain.expiresAt > Date.now()) {
        scheduleSupportTrainEnd(activeTrain);
        return;
      }

      emitSupportTrainAlert("end", activeTrain, null);
      resetSupportTrain(activeTrain);
    }, delay);
  }

  function getSupportTrainContribution(platformKey, type, data, message) {
    if (!platformKey || !type) {
      return null;
    }

    const key = `${platformKey}.${type}`;
    let points = 0;
    let label = "";

    if (platformKey === "kick" && (isKickGiftItemEvent(platformKey, type, data) || isKickDirectKicksEvent(platformKey, type, data))) {
      const kicks = extractKickGiftAmount(data);
      if (kicks !== null) {
        points = Math.max(8, Math.round(Math.sqrt(Math.max(1, kicks)) * 9));
        const giftMeta = extractKickGiftMeta(data);
        label = giftMeta && giftMeta.name ? giftMeta.name : `${formatPlainNumber(kicks)} Kicks`;
      }
    } else if ([
      "youtube.SuperChat",
      "youtube.SuperSticker",
      "streamlabs.Donation",
      "streamelements.Tip",
      "kofi.Donation",
      "fourthwall.Donation",
      "twitch.CharityDonation",
      "streamlabs.Merchandise",
    ].includes(key)) {
      const amount = extractNumericMonetaryValue(data) || extractNumericAmountFromText(message && message.amountText);
      if (amount !== null) {
        points = Math.max(12, Math.round(amount * 12));
        label = message && message.amountText ? message.amountText : formatCurrencyAmount(amount, pickFirstString(data, ["currencyCode", "currency", "tipCurrency"]));
      } else if (key === "streamlabs.Merchandise") {
        const quantity = pickFirstNumber(data, ["quantity", "count", "amount"]);
        if (quantity !== null) {
          points = Math.max(20, quantity * 25);
          label = `x${quantity}`;
        }
      }
    } else if (["twitch.Cheer", "twitch.CoinCheer"].includes(key)) {
      const bits = pickFirstNumber(data, ["bits", "cheerAmount", "amount", "coins"]);
      if (bits !== null) {
        points = Math.max(6, Math.round(bits / 20));
        label = `${formatPlainNumber(bits)} bits`;
      }
    } else if ([
      "kick.Subscription",
      "kick.Resubscription",
      "twitch.Sub",
      "twitch.ReSub",
      "youtube.NewSponsor",
      "kofi.Subscription",
      "kofi.Resubscription",
      "fourthwall.SubscriptionPurchased",
    ].includes(key)) {
      points = 45;
      label = "subscription";
    } else if (["kick.GiftSubscription", "twitch.GiftSub"].includes(key)) {
      points = 55;
      label = "gifted sub";
    } else if (["kick.MassGiftSubscription", "kick.sGifted", "kick.KicksGifted", "twitch.GiftBomb", "youtube.MembershipGift"].includes(key)) {
      const count = resolveMassGiftCount(data);
      if (count !== null) {
        points = Math.max(60, count * 55);
        label = `${formatPlainNumber(count)} gifts`;
      }
    }

    if (!Number.isFinite(points) || points <= 0) {
      return null;
    }

    return {
      platform: platformKey,
      points,
      label: label || formatBadgeLabel(type),
      username: message && typeof message.username === "string" ? message.username : "",
    };
  }

  function processSupportTrainMessageItem(message) {
    if (!config.trainOnly || !message || message.variant !== "special") {
      return;
    }

    const contribution = getSupportTrainContributionFromMessage(message);
    if (!contribution) {
      return;
    }

    const train = state.supportTrain || createSupportTrainState();
    state.supportTrain = train;
    const now = Date.now();
    const wasActive = train.active && train.expiresAt > now;
    const hadDormantProgress = !wasActive && Number.isFinite(train.expiresAt) && train.expiresAt > now && Number.isFinite(train.totalPoints) && train.totalPoints > 0;

    if (!wasActive) {
      if (!hadDormantProgress && train.totalPoints > 0) {
        resetSupportTrain(train);
      }

      train.totalPoints = (Number.isFinite(train.totalPoints) ? train.totalPoints : 0) + contribution.points;
      train.eventCount = (Number.isFinite(train.eventCount) ? train.eventCount : 0) + 1;
      train.platformPoints[contribution.platform] = (train.platformPoints[contribution.platform] || 0) + contribution.points;
      train.dominantPlatform = getSupportTrainDominantPlatform(train.platformPoints, contribution.platform);
      train.lastContributor = contribution.username || "";
      train.lastContributionLabel = contribution.label || "";
      train.expiresAt = now + SUPPORT_TRAIN_WINDOW_MS;

      if (train.totalPoints < SUPPORT_TRAIN_TRIGGER_POINTS) {
        return;
      }

      train.active = true;
    } else {
      train.totalPoints += contribution.points;
      train.eventCount += 1;
      train.platformPoints[contribution.platform] = (train.platformPoints[contribution.platform] || 0) + contribution.points;
      train.dominantPlatform = getSupportTrainDominantPlatform(train.platformPoints, contribution.platform);
      train.lastContributor = contribution.username || "";
      train.lastContributionLabel = contribution.label || "";
      train.expiresAt = now + SUPPORT_TRAIN_WINDOW_MS;
    }

    const previousLevel = train.level;
    train.level = getSupportTrainLevel(train.totalPoints);
    scheduleSupportTrainEnd(train);
    renderSupportTrainHud();
    persistSupportTrain();

    if (train.level > previousLevel) {
      triggerSupportTrainHudBurst("levelup");
      return;
    }

    triggerSupportTrainHudBurst(wasActive ? "step" : "start");
  }

  function getSupportTrainContributionFromMessage(message) {
    if (!message || message.variant !== "special") {
      return null;
    }

    if (typeof message.messageId === "string" && message.messageId.startsWith("support-train:")) {
      return null;
    }

    if (typeof message.messageId !== "string" || !message.messageId.startsWith("train-step:")) {
      return null;
    }

    const badges = Array.isArray(message.badges)
      ? message.badges.map((badge) => String(badge || "").trim().toLowerCase())
      : [];
    const amount = extractNumericAmountFromText(message.amountText);
    let points = 0;
    let label = message.giftName || message.amountText || message.text || "";

    if (message.platform === "kick" && (message.tone === "tone-kick-gift" || message.tone === "tone-kick-kicks") && amount !== null) {
      points = Math.max(8, Math.round(Math.sqrt(Math.max(1, amount)) * 9));
    } else if ((message.platform === "streamlabs" || message.platform === "streamelements") && amount !== null) {
      points = Math.max(12, Math.round(amount * 12));
    } else if (message.platform === "youtube" && badges.includes("super sticker") && amount !== null) {
      points = Math.max(12, Math.round(amount * 12));
    } else if (message.platform === "twitch" && badges.includes("cheer") && amount !== null) {
      points = Math.max(6, Math.round(amount / 20));
      label = `${formatPlainNumber(amount)} bits`;
    } else if (message.platform === "kick" && badges.includes("gift bomb")) {
      const giftedCount = amount !== null ? amount : extractNumericAmountFromText(message.text);
      if (giftedCount !== null) {
        points = Math.max(60, giftedCount * 55);
        label = `${formatPlainNumber(giftedCount)} gifts`;
      }
    }

    if (!Number.isFinite(points) || points <= 0) {
      return null;
    }

    return {
      platform: message.platform || "kick",
      points,
      label,
      username: typeof message.username === "string" ? message.username : "",
    };
  }

  function getSupportTrainDominantPlatform(platformPoints, fallbackPlatform) {
    const entries = Object.entries(platformPoints || {});
    if (!entries.length) {
      return fallbackPlatform || "kick";
    }

    entries.sort((left, right) => {
      if (right[1] === left[1]) {
        return String(left[0]).localeCompare(String(right[0]));
      }
      return right[1] - left[1];
    });

    return entries[0][0] || fallbackPlatform || "kick";
  }

  function getSupportTrainLevel(totalPoints) {
    let level = 0;
    for (const threshold of SUPPORT_TRAIN_LEVEL_THRESHOLDS) {
      if (totalPoints >= threshold) {
        level += 1;
      } else {
        break;
      }
    }
    return level;
  }

  function getSupportTrainProgressText(train) {
    if (!train) {
      return "";
    }

    const nextThreshold = SUPPORT_TRAIN_LEVEL_THRESHOLDS[train.level];
    if (!nextThreshold) {
      return "MAX";
    }

    const currentFloor = train.level > 0 ? SUPPORT_TRAIN_LEVEL_THRESHOLDS[train.level - 1] : 0;
    const segment = Math.max(1, nextThreshold - currentFloor);
    const progress = Math.max(0, Math.min(1, (train.totalPoints - currentFloor) / segment));
    return `${Math.round(progress * 100)}%`;
  }

  function emitSupportTrainAlert(kind, train, contribution) {
    if (!train) {
      return;
    }

    const platform = getSupportTrainThemePlatform(train.dominantPlatform || (contribution ? contribution.platform : "kick"));
    const meta = PLATFORM_META[platform] || PLATFORM_META.kick;
    const trainLabel = getSupportTrainDisplayLabel(platform);
    const badge = kind === "end" ? "Train End" : "Support Train";
    const messageId = `support-train:${kind}:${platform}:${train.totalPoints}:${train.eventCount}`;
    if (train.lastSyntheticId === messageId) {
      return;
    }
    train.lastSyntheticId = messageId;

    let text = "";
    if (kind === "start") {
      text = `started by ${contribution && contribution.username ? contribution.username : trainLabel} with ${contribution ? contribution.label : "support"}`;
    } else if (kind === "levelup") {
      text = `reached level ${train.level} ${getSupportTrainProgressText(train)} to next`;
      if (contribution && contribution.label) {
        text += ` | latest ${contribution.label}`;
      }
    } else {
      text = `ended at level ${train.level} with ${formatPlainNumber(train.totalPoints)} points`;
    }

    const synthetic = {
      platform,
      variant: "special",
      username: `${trainLabel} Support Train`,
      text,
      badges: [badge],
      color: "#8fe9ff",
      avatarUrl: "",
      isBroadcaster: false,
      amountText: "",
      tone: `tone-hypetrain-${platform}`,
      memberLabel: "",
      messageId,
      userId: "",
      giftId: "",
      giftName: "",
      giftImageUrl: "",
      contentParts: [],
      paidEntryEffect: true,
      timestamp: Date.now(),
    };

    pushSyntheticSupportTrainMessage(synthetic);
    renderSupportTrainHud();
    triggerSupportTrainHudBurst(kind === "levelup" ? "levelup" : kind);
  }

  function pushSyntheticSupportTrainMessage(message) {
    if (!message) {
      return;
    }
    const canPublishShared = acquireSupportTrainMessageLock(message.messageId);
    if (!isLocalOnlyMode() && canPublishShared) {
      fetch(HISTORY_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Support Train alert failed with ${response.status}`);
          }
          appendHistoryMessage(message);
        })
        .catch(() => {
          appendHistoryMessage(message);
        });
      return;
    }

    appendHistoryMessage(message);
  }

  function getSupportTrainThemePlatform(platformKey) {
    switch (platformKey) {
      case "twitch":
      case "kick":
      case "youtube":
      case "streamlabs":
      case "streamelements":
        return platformKey;
      case "kofi":
      case "fourthwall":
        return "streamlabs";
      default:
        return "kick";
    }
  }

  function getSupportTrainDisplayLabel(platformKey) {
    if (platformKey === "streamelements" || platformKey === "streamlabs") {
      return "LucidPay";
    }
    const meta = PLATFORM_META[platformKey] || PLATFORM_META.kick;
    return meta.label;
  }

  function acquireSupportTrainMessageLock(messageId) {
    if (!messageId) {
      return true;
    }

    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(SUPPORT_TRAIN_MESSAGE_LOCK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.messageId === messageId &&
          Number.isFinite(parsed.timestamp) &&
          now - parsed.timestamp < 10000
        ) {
          return false;
        }
      }
      window.localStorage.setItem(SUPPORT_TRAIN_MESSAGE_LOCK_KEY, JSON.stringify({
        messageId,
        timestamp: now,
      }));
    } catch (error) {
      return true;
    }

    return true;
  }

  function extractNumericAmountFromText(text) {
    const raw = String(text || "").replace(/,/g, "");
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatDurationClock(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function renderStatusItems() {
    ui.statusItems.innerHTML = "";

    const order = getStatusOrder();
    for (const key of order) {
      const meta = PLATFORM_META[key];
      const item = document.createElement("div");
      item.className = "status-item";
      item.dataset.platform = key;
      item.setAttribute("title", meta.label);
      item.setAttribute("aria-label", meta.label);
      item.innerHTML = `
        <span class="status-icon" style="background:${toRgba(meta.color, 0.92)};">${statusPlatformIconSvg(key)}</span>
        <span class="status-dot" aria-hidden="true"></span>
        <span class="status-count hidden" aria-hidden="true"></span>
      `;
      ui.statusItems.appendChild(item);
    }
  }

  function getStatusOrder() {
    const seen = new Set();
    const order = [];
    const preferred = ["streamerbot", "streamlabs", "streamelements"];

    for (const key of preferred) {
      if ((key === "streamerbot" || config.enabledPlatforms.includes(key)) && !seen.has(key)) {
        order.push(key);
        seen.add(key);
      }
    }

    for (const key of config.enabledPlatforms) {
      if (!seen.has(key)) {
        order.push(key);
        seen.add(key);
      }
    }

    return order;
  }

  function renderStatus() {
    const socketConnected = !!state.connectedAt && state.socket && state.socket.readyState === WebSocket.OPEN;

    if (!socketConnected && state.platforms.streamerbot.tone !== "disconnected") {
      setSocketState("disconnected", "Disconnected");
    }

    for (const key of Object.keys(state.platforms)) {
      const meta = PLATFORM_META[key];

      if (key !== "streamerbot") {
        const platform = state.platforms[key];
        const derived = derivePlatformStatus(key, platform);
        platform.tone = derived.tone;
        platform.label = derived.label;
      }

      const item = ui.statusItems.querySelector(`[data-platform="${key}"]`);
      if (!item) {
        continue;
      }

      if (!socketConnected && key !== "streamerbot") {
        item.classList.add("hidden");
        item.setAttribute("title", `${meta.label}: Unavailable`);
        item.setAttribute("aria-label", `${meta.label}: Unavailable`);
        continue;
      }

      item.classList.remove("hidden");
      item.className = `status-item state-${state.platforms[key].tone}`;
      const countNode = item.querySelector(".status-count");
      const effectiveViewerCount = shouldShowViewerCount(key)
        ? (typeof state.platforms[key].viewerCount === "number" ? state.platforms[key].viewerCount : 0)
        : null;
      const countLabel = formatViewerCount(effectiveViewerCount);
      if (countNode) {
        if (countLabel) {
          countNode.textContent = countLabel;
          countNode.classList.remove("hidden");
        } else {
          countNode.textContent = "";
          countNode.classList.add("hidden");
        }
      }
      const titleSuffix = countLabel ? ` (${countLabel} viewers)` : "";
      item.setAttribute("title", `${meta.label}: ${state.platforms[key].label}${titleSuffix}`);
      item.setAttribute("aria-label", `${meta.label}: ${state.platforms[key].label}${titleSuffix}`);
    }

    renderDockComposer();
  }

  function formatViewerCount(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return "";
    }

    if (value >= 1000000) {
      const compact = value >= 10000000
        ? `${Math.round(value / 1000000)}M`
        : `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
      return compact;
    }

    if (value >= 1000) {
      const compact = value >= 10000
        ? `${Math.round(value / 1000)}k`
        : `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
      return compact;
    }

    return String(value);
  }

  function shouldShowViewerCount(platformKey) {
    return platformKey === "twitch" || platformKey === "kick" || platformKey === "youtube";
  }

  function derivePlatformStatus(platformKey, platform) {
    if (!state.internetOnline) {
      return { tone: "disconnected", label: "Offline" };
    }

    if (!state.setupComplete && state.connectedAt) {
      return { tone: "checking", label: "Checking" };
    }

    if (!platform.accountConnected) {
      return { tone: "disconnected", label: "Disconnected" };
    }

    if (!platform.chatConfirmed) {
      return { tone: "checking", label: "Acct Only" };
    }

    if (platform.lastMessageAt && Date.now() - platform.lastMessageAt > staleAfterMs) {
      return { tone: "stale", label: "Stale" };
    }

    return { tone: "connected", label: "Connected" };
  }

  function renderFeed() {
    cleanupFeedDom();

    const items = getRenderableFeedItems();
    const fragment = document.createDocumentFragment();
    const mountedCards = [];

    for (const item of items) {
      const built = buildMessageFragment(item, false);
      if (!built) {
        continue;
      }
      const card = built.querySelector(".message-card");
      fragment.appendChild(built);
      if (card) {
        mountedCards.push({ card, item });
      }
    }

    if (!mountedCards.length) {
      return;
    }

    ui.chatFeed.appendChild(fragment);
    for (const entry of mountedCards) {
      initializeDeferredEffects(entry.card, entry.item);
    }
  }

  function appendMessageToFeed(item, animate = true) {
    enqueueFeedRender(item, animate);
  }

  function buildMessageFragment(item, animate = false) {
    try {
      if (!shouldDisplayMessage(item)) {
        return null;
      }

      const fragment = ui.template.content.cloneNode(true);
      const card = fragment.querySelector(".message-card");
      const avatar = fragment.querySelector(".message-avatar");
      const avatarFallback = fragment.querySelector(".message-avatar-fallback");
      const icons = fragment.querySelector(".message-icons");
      const user = fragment.querySelector(".message-user");
      const time = fragment.querySelector(".message-time");
      const text = fragment.querySelector(".message-text");
      const badges = fragment.querySelector(".message-badges");
      const amount = fragment.querySelector(".message-amount");
      const amountHost = document.createElement("div");
      amountHost.className = "message-amount-host";
      const meta = PLATFORM_META[item.platform];
      const displayAmountText = getDisplayAmountText(item);
      ensureDeferredAvatar(item);

    if (item.variant === "chat") {
      card.classList.add("chat-accent", `platform-${item.platform}`);
    }

      if (item.variant === "special") {
        card.classList.add("special");
        card.classList.add(`special-platform-${item.platform}`);
        if (item.tone) {
          card.classList.add(item.tone);
        }
      if (isGiftRecipientSpecial(item)) {
        card.classList.add("recipient-special");
      }
      if (displayAmountText) {
        card.classList.add("has-amount");
      }
      if (item.platform === "kick" && item.tone === "tone-kick-gift") {
        const kickGiftAmountLayoutClass = getKickGiftAmountLayoutClass(item);
        if (kickGiftAmountLayoutClass) {
          card.classList.add(kickGiftAmountLayoutClass);
        }
      }
      if (hasSpecialMedia(item)) {
        card.classList.add("has-gift-media");
        const kickGiftScaleClass = getKickGiftScaleClass(item);
        if (kickGiftScaleClass) {
          card.classList.add(kickGiftScaleClass);
        }
      }
    }

    const loopWord = getLoopBackgroundWord(item);
    if (loopWord) {
      card.classList.add("has-loop-word");
      card.classList.add(`loop-word-${loopWord.toLowerCase()}`);
      const loopMask = document.createElement("div");
      loopMask.className = "message-loop-word-mask";
      const loopLayer = document.createElement("div");
      loopLayer.className = "message-loop-word-layer";
      loopLayer.dataset.word = loopWord.toLowerCase();
      loopLayer.textContent = `${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}
${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord} ${loopWord}`;
      loopMask.appendChild(loopLayer);
      card.appendChild(loopMask);
    }

    if (item.variant === "member") {
      card.classList.add("member");
      card.classList.add(`member-platform-${item.platform}`);
    }

    const displayAvatarUrl = getDisplayAvatarUrl(item);

    if (displayAvatarUrl) {
      avatar.src = displayAvatarUrl;
      avatar.alt = `${item.username} avatar`;
      avatar.classList.remove("hidden");
      avatarFallback.classList.add("hidden");
    } else {
      avatar.classList.add("hidden");
      avatarFallback.classList.remove("hidden");
      avatarFallback.textContent = getInitial(item.username);
      applyFallbackAvatarStyle(item, avatarFallback);
    }

    icons.innerHTML = renderMessageIcons(item);

    user.textContent = item.username;
    user.classList.toggle("supporter-name", item.variant === "special");
    user.classList.toggle("member-name", item.variant === "member");
    user.style.color = getUserDisplayColor(item);

    time.textContent = new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    text.classList.toggle("message-text-emote-only", isEmoteOnlyMessage(item));
    renderMessageText(text, item);
    if (item.variant === "special") {
      renderSpecialMedia(fragment, item);
      if (shouldRenderPaidAsh(item)) {
        appendPaidAshCanvas(fragment);
      }
    }

    if (displayAmountText) {
      renderAmountContent(amount, item);
      amount.classList.remove("hidden");
      if (item.variant === "special") {
        amountHost.appendChild(amount);
        card.appendChild(amountHost);
      }
    } else {
      amount.textContent = "";
      amount.classList.add("hidden");
    }

    const visibleBadges = Array.isArray(item.badges)
      ? item.badges.filter((badge) => shouldRenderBadgePill(badge))
      : [];

    if (visibleBadges.length) {
      badges.classList.remove("hidden");
      if (item.variant === "member") {
        badges.appendChild(createMemberBadgeNode(item));
      }
      for (const badge of visibleBadges) {
        if (item.variant === "member" && badge === (item.memberLabel || getMembershipLabel(item.platform, {}))) {
          continue;
        }
        const badgeNode = document.createElement("span");
        badgeNode.className = `badge-pill${item.variant === "member" ? " badge-pill-member" : ""}`;
        if (item.variant === "special") {
          badgeNode.classList.add("badge-pill-special");
          if (item.platform === "kick" && item.tone === "tone-kick-gift") {
            badgeNode.classList.add("badge-pill-kick-gift");
            badgeNode.innerHTML = `
              <span class="badge-pill-platform-icon" aria-hidden="true">${statusPlatformIconSvg("kick")}</span>
              <span class="badge-pill-text">Kicks</span>
            `;
          } else if (item.platform === "streamelements" && isTipTone(item.tone)) {
            badgeNode.classList.add("badge-pill-tip");
            badgeNode.innerHTML = `
              <span class="badge-pill-platform-icon" aria-hidden="true">${statusPlatformIconSvg("streamelements")}</span>
              <span class="badge-pill-text">LucidPay Tip</span>
            `;
          } else {
            badgeNode.innerHTML = `
              <span class="badge-pill-platform-icon" aria-hidden="true">${statusPlatformIconSvg(item.platform)}</span>
              <span class="badge-pill-text">${escapeHtml(badge)}</span>
            `;
          }
        } else if (item.platform === "kick" && item.tone === "tone-kick-gift") {
          badgeNode.innerHTML = `
            <span class="badge-pill-platform-icon" aria-hidden="true">${statusPlatformIconSvg("kick")}</span>
            <span class="badge-pill-text">Kicks</span>
          `;
        } else {
          badgeNode.textContent = badge;
        }
        badges.appendChild(badgeNode);
      }
    } else if (item.variant === "member") {
      badges.classList.remove("hidden");
      badges.appendChild(createMemberBadgeNode(item));
    }

    if (item.variant === "special" || item.variant === "member") {
      card.style.borderColor = toRgba(meta ? meta.color : "#ffffff", 0.28);
    }

    if (canModerateItem(item)) {
      card.classList.add("can-moderate");
      if (item.messageId) {
        card.dataset.messageId = item.messageId;
      }
      if (item.userId) {
        card.dataset.userId = item.userId;
      }
      card.dataset.username = item.username || "";
      card.dataset.platform = item.platform || "";
      card.appendChild(createModerationToolbar(item));
    }

      if (animate) {
        card.classList.add("message-enter");
        if (item.variant === "special" && item.paidEntryEffect) {
          card.classList.add("message-enter-paid");
        }
      }

      return fragment;
    } catch (error) {
      debugRuntimeIssue("build-message-fragment", {
        message: error && error.message ? error.message : String(error || "Unknown render error"),
        platform: item && item.platform ? item.platform : "",
        variant: item && item.variant ? item.variant : "",
        username: item && item.username ? item.username : "",
        text: item && item.text ? item.text : "",
      });
      return null;
    }
  }

  function initializeDeferredEffects(card, item) {
    if (!card || !item) {
      return;
    }

    if (item.variant === "special" && shouldRenderPaidAsh(item)) {
      const canvas = card.querySelector(".message-paid-ash-canvas");
      if (canvas && !canvas.dataset.ashReady) {
        canvas.dataset.ashReady = "true";
        setupPaidAshCanvas(card, canvas, getPaidAshColor(item));
      }
    }
  }

  function getDisplayAvatarUrl(item) {
    if (item && typeof item.avatarUrl === "string" && item.avatarUrl.trim()) {
      return item.avatarUrl.trim();
    }

    if (item && item.platform === "twitch") {
      const cacheKey = getTwitchAvatarCacheKey(item);
      if (cacheKey && state.twitchAvatarCache.has(cacheKey)) {
        return state.twitchAvatarCache.get(cacheKey);
      }
    }

    if (item && item.platform === "streamelements") {
      return LUCIDPAY_STATUS_ICON;
    }

    return "";
  }

  function ensureDeferredAvatar(item) {
    if (!item || item.platform !== "twitch" || getDisplayAvatarUrl(item)) {
      return;
    }

    if (state.twitchAvatarLookupUnavailable) {
      return;
    }

    const cacheKey = getTwitchAvatarCacheKey(item);
    if (!cacheKey || state.twitchAvatarPending.has(cacheKey)) {
      return;
    }

    state.twitchAvatarPending.add(cacheKey);
    const params = new URLSearchParams({ login: cacheKey });
    if (item.userId) {
      params.set("userId", item.userId);
    }
    if (item.messageId) {
      params.set("messageId", item.messageId);
    }

    fetchTwitchAvatar(cacheKey, params)
      .then(async (response) => {
        if (!response || !response.ok) {
          return null;
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload || typeof payload.avatarUrl !== "string" || !payload.avatarUrl.trim()) {
          return;
        }

        state.twitchAvatarCache.set(cacheKey, payload.avatarUrl.trim());
        applyFetchedAvatarToFeed(item, payload.avatarUrl.trim());
      })
      .catch(() => {
        // Leave fallback avatar in place if Twitch lookup is unavailable.
      })
      .finally(() => {
        state.twitchAvatarPending.delete(cacheKey);
      });
  }

  function fetchTwitchAvatar(login, params) {
    if (config.twitchClientId && config.twitchAccessToken) {
      const headers = {
        "Client-Id": config.twitchClientId,
        "Authorization": `Bearer ${config.twitchAccessToken}`,
      };

      return fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
        cache: "no-store",
        headers,
      }).then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            state.twitchAvatarLookupUnavailable = true;
          }
          return response;
        }

        const payload = await response.json();
        const avatarUrl = Array.isArray(payload && payload.data) && payload.data[0] && typeof payload.data[0].profile_image_url === "string"
          ? payload.data[0].profile_image_url.trim()
          : "";

        return new Response(JSON.stringify({
          status: avatarUrl ? "ok" : "missing",
          login,
          avatarUrl,
        }), {
          status: avatarUrl ? 200 : 404,
          headers: { "Content-Type": "application/json" },
        });
      }).catch(() => null);
    }

    if (window.location.protocol === "file:") {
      state.twitchAvatarLookupUnavailable = true;
      return Promise.resolve(null);
    }

    return fetch(`/api/twitch/avatar?${params.toString()}`, { cache: "no-store" })
      .then((response) => {
        if (response.status === 503) {
          state.twitchAvatarLookupUnavailable = true;
          return null;
        }
        return response;
      })
      .catch(() => null);
  }

  function getTwitchAvatarCacheKey(item) {
    if (!item) {
      return "";
    }

    return normalizeUserName(item.username || item.userId || "");
  }

  function applyFetchedAvatarToFeed(sourceItem, avatarUrl) {
    if (!avatarUrl) {
      return;
    }

    let changed = false;
    for (const item of state.feedItems) {
      if (!item || item.platform !== "twitch") {
        continue;
      }

      const sameUser = sourceItem.userId
        ? item.userId && item.userId === sourceItem.userId
        : normalizeUserName(item.username) === normalizeUserName(sourceItem.username);
      if (!sameUser) {
        continue;
      }

      if (item.avatarUrl !== avatarUrl) {
        item.avatarUrl = avatarUrl;
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    syncLocalBackup();
    renderFeed();
  }

  function canModerateItem(item) {
    return !!config.showModerationControls &&
      !!item &&
      ["twitch", "kick", "youtube"].includes(item.platform) &&
      typeof item.username === "string" &&
      !!item.username.trim();
  }

  function createModerationToolbar(item) {
    const toolbar = document.createElement("div");
    toolbar.className = "message-moderation-toolbar";

    const actions = [
      {
        key: "delete",
        label: "Delete message",
        icon: moderationDeleteIconSvg(),
        disabled: !item.messageId,
      },
      {
        key: "pin",
        label: "Pin message",
        icon: moderationPinIconSvg(),
        disabled: !item.messageId || !config.moderationPinAction,
      },
      {
        key: "timeout",
        label: `Timeout ${item.username}`,
        icon: moderationTimeoutIconSvg(),
        disabled: !config.moderationTimeoutAction,
      },
      {
        key: "ban",
        label: `Ban ${item.username}`,
        icon: moderationBanIconSvg(),
        disabled: !config.moderationBanAction,
      },
    ];

    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "message-moderation-button";
      button.setAttribute("aria-label", action.label);
      button.setAttribute("title", action.disabled ? `${action.label} unavailable` : action.label);
      button.innerHTML = action.icon;
      button.disabled = action.disabled;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openModerationDialog(item, action.key);
      });
      toolbar.appendChild(button);
    }

    return toolbar;
  }

  function moderationDeleteIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4.5h6l.7 1.5H20v2H4V6h4.3L9 4.5Zm1 6v6m4-6v6M7 8h10l-.8 11a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 8Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function moderationPinIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 4 5 5-2.4.8-2.8 2.8.9 4.5-1.1 1.1-4.5-.9-3.6 3.6-.7-.7 3.6-3.6-.9-4.5 1.1-1.1 4.5.9 2.8-2.8L15 4Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function moderationTimeoutIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v6l3.8 2.2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function moderationBanIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 15.5 15.5 8.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  }

  function applyFallbackAvatarStyle(item, avatarFallback) {
    const seed = `${item.platform}:${item.username || "?"}`;
    const hue = hashString(seed) % 360;
    avatarFallback.style.background = `linear-gradient(180deg, hsla(${hue}, 74%, 56%, 0.96), hsla(${(hue + 28) % 360}, 70%, 42%, 0.96))`;
    avatarFallback.style.borderColor = `hsla(${hue}, 82%, 72%, 0.34)`;
    avatarFallback.style.color = "#ffffff";
    avatarFallback.style.textShadow = "0 2px 8px rgba(0, 0, 0, 0.28)";
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getUserDisplayColor(item) {
    if (!item) {
      return USERNAME_COLOR_PALETTE[0];
    }

    if (item.variant === "special") {
      return getPaidNameColor(item);
    }

    if (item && typeof item.color === "string" && item.color.trim()) {
      return item.color.trim();
    }

    const seed = (item.userId || item.username)
      ? `${item.platform || "chat"}:${item.userId || item.username}`
      : "chat:unknown";
    return USERNAME_COLOR_PALETTE[hashString(seed) % USERNAME_COLOR_PALETTE.length];
  }

  function getPaidNameColor(item) {
    if (!item) {
      return "#fff3dc";
    }

    if (item.tone === "tone-hypetrain-twitch" ||
      item.tone === "tone-hypetrain-kick" ||
      item.tone === "tone-hypetrain-youtube" ||
      item.tone === "tone-hypetrain-streamlabs" ||
      item.tone === "tone-hypetrain-streamelements") {
      return "#8fe9ff";
    }

    if (item.platform === "kick") {
      return "#efffd8";
    }
    if (item.platform === "twitch") {
      return "#f3e8ff";
    }
    if (item.platform === "youtube") {
      return "#fff0f3";
    }
    if (item.platform === "streamlabs") {
      return "#effcff";
    }
    if (item.platform === "streamelements") {
      return "#effcff";
    }
    if (isTipTone(item.tone)) {
      return "#effcff";
    }
    return "#fff4de";
  }

  function shouldDisplayMessage(item) {
    if (!item) {
      return false;
    }

    if (shouldHideDeletedMessages() && item.messageId && state.removedMessageIds.has(item.messageId)) {
      return false;
    }

    if (!shouldShowFollowAlerts() && isFollowAlertItem(item)) {
      return false;
    }

    const normalizedUser = normalizeUserName(item.username);
    if (normalizedUser && getIgnoreUsersSetting().includes(normalizedUser)) {
      return false;
    }

    if (shouldIgnoreBangCommands()) {
      const text = String(item.text || "").trimStart();
      if (text.startsWith("!")) {
        return false;
      }
    }

    return true;
  }

  function maybeAutoScroll() {
    if (state.scrollPaused) {
      updatePauseBanner();
      return;
    }

    if (state.renderFlushHandle || state.pendingRenderQueue.length) {
      state.scrollAfterFlush = true;
      return;
    }

    scrollToLatest();
  }

  function scrollToLatest() {
    state.suppressScrollPauseUntil = Date.now() + 200;
    snapViewportToLatest();
    state.scrollPaused = false;
    state.pausedNewCount = 0;
    updatePauseBanner();
  }

  function snapViewportToLatest() {
    const scrollingElement = document.scrollingElement || document.documentElement || document.body;
    const scrollHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
      ui.chatFeed ? ui.chatFeed.scrollHeight : 0,
    );
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const targetTop = Math.max(0, scrollHeight - viewportHeight);

    for (const node of [scrollingElement, document.documentElement, document.body]) {
      if (node && typeof node.scrollTop === "number") {
        node.scrollTop = targetTop;
      }
    }

    window.scrollTo({
      top: targetTop,
      left: 0,
      behavior: "auto",
    });
  }

  function scheduleScrollToLatestBurst() {
    if (state.renderFlushHandle || state.pendingRenderQueue.length) {
      state.scrollAfterFlush = true;
      return;
    }

    scrollToLatest();
    window.requestAnimationFrame(() => {
      snapViewportToLatest();
      window.requestAnimationFrame(() => {
        snapViewportToLatest();
      });
    });
    window.setTimeout(snapViewportToLatest, 80);
    window.setTimeout(snapViewportToLatest, 220);
  }

  function scheduleInitialAutoFollow() {
    state.initialAutoFollowUntil = Date.now() + 4000;
    state.scrollPaused = false;
    state.pausedNewCount = 0;
    updatePauseBanner();

    const delays = [0, 40, 120, 260, 500, 900, 1400, 2200, 3200];
    for (const delay of delays) {
      window.setTimeout(() => {
        state.suppressScrollPauseUntil = Date.now() + 250;
        snapViewportToLatest();
      }, delay);
    }
  }

  function handleViewportScroll() {
    if (Date.now() < state.suppressScrollPauseUntil) {
      return;
    }

    if (Date.now() < state.initialAutoFollowUntil) {
      state.scrollPaused = false;
      state.pausedNewCount = 0;
      updatePauseBanner();
      return;
    }

    const isAtBottom = getDistanceFromBottom() <= LIVE_SCROLL_THRESHOLD;
    if (isAtBottom) {
      if (state.scrollPaused || state.pausedNewCount) {
        state.scrollPaused = false;
        state.pausedNewCount = 0;
        updatePauseBanner();
      }
      return;
    }

    if (!state.scrollPaused) {
      state.scrollPaused = true;
      updatePauseBanner();
    }
  }

  function getDistanceFromBottom() {
    return document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  }

  function updatePauseBanner() {
    if (!ui.pauseBanner || !ui.pauseCount) {
      return;
    }

    if (!state.scrollPaused) {
      ui.pauseBanner.classList.add("hidden");
      ui.pauseCount.classList.add("hidden");
      ui.pauseCount.textContent = "";
      return;
    }

    ui.pauseBanner.classList.remove("hidden");
    if (state.pausedNewCount > 0) {
      ui.pauseCount.textContent = state.pausedNewCount === 1
        ? "1 new"
        : `${state.pausedNewCount} new`;
      ui.pauseCount.classList.remove("hidden");
    } else {
      ui.pauseCount.textContent = "";
      ui.pauseCount.classList.add("hidden");
    }
  }

  function loadPersistedFeed() {
    state.feedItems = [];

    if (isLocalOnlyMode()) {
      loadLocalBackup();
      state.feedItems = state.feedItems.filter((item) => passesFeedClearCutoff(item));
      hydratePlatformStatusFromHistory();
      renderFeed();
      scheduleScrollToLatestBurst();
      return;
    }

    fetch(HISTORY_API_PATH, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`History request failed with ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (Array.isArray(payload)) {
          state.feedItems = payload.filter(isValidStoredMessage).filter((item) => passesFeedClearCutoff(item));
          hydratePlatformStatusFromHistory();
          syncLocalBackup();
          renderFeed();
          scheduleScrollToLatestBurst();
        }
      })
      .catch(() => {
        loadLocalBackup();
        state.feedItems = state.feedItems.filter((item) => passesFeedClearCutoff(item));
        hydratePlatformStatusFromHistory();
        renderFeed();
        scheduleScrollToLatestBurst();
      });
  }

  function pollPersistedFeed() {
    if (isLocalOnlyMode()) {
      return;
    }

    const now = Date.now();
    if (state.historyStreamConnected && now - state.lastHistoryRealtimeAt < HISTORY_STREAM_BACKUP_POLL_MS) {
      return;
    }

    if (state.historySyncInFlight) {
      return;
    }

    state.historySyncInFlight = true;
    state.lastHistoryPollAt = now;

    fetch(HISTORY_API_PATH, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`History request failed with ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (!Array.isArray(payload)) {
          return;
        }

        const nextItems = payload.filter(isValidStoredMessage).filter((item) => passesFeedClearCutoff(item));
        if (getFeedSignature(nextItems) === getFeedSignature(state.feedItems)) {
          return;
        }

        const previousCount = state.feedItems.length;
        let visibleAddedCount = 0;
        if (canAppendIncrementally(state.feedItems, nextItems)) {
          const appendedItems = nextItems.slice(previousCount);
          state.feedItems = nextItems;
          for (const item of appendedItems) {
            if (shouldDisplayMessage(item)) {
              visibleAddedCount += 1;
            }
            appendMessageToFeed(item);
          }
        } else {
          state.feedItems = nextItems;
          renderFeed();
          visibleAddedCount = nextItems
            .slice(previousCount)
            .filter((item) => shouldDisplayMessage(item))
            .length;
        }
        hydratePlatformStatusFromHistory();
        syncLocalBackup();

        if (state.scrollPaused) {
          if (visibleAddedCount > 0) {
            state.pausedNewCount += visibleAddedCount;
            updatePauseBanner();
          }
          return;
        }

        if (visibleAddedCount > 0) {
          scheduleScrollToLatestBurst();
        }
      })
      .catch(() => {
        // Ignore intermittent history sync failures; live websocket updates still continue.
      })
      .finally(() => {
        state.historySyncInFlight = false;
      });
  }

  function connectHistoryStream() {
    if (isLocalOnlyMode()) {
      return;
    }

    if (!("EventSource" in window)) {
      return;
    }

    if (state.historyEventSource) {
      state.historyEventSource.close();
    }

    const source = new EventSource(HISTORY_STREAM_PATH);
    state.historyEventSource = source;
    state.historyStreamConnected = false;

    source.onopen = () => {
      if (state.historyEventSource === source) {
        state.historyStreamConnected = true;
      }
    };

    source.onmessage = (event) => {
      if (!event || !event.data) {
        return;
      }

      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (error) {
        return;
      }

      if (payload && payload.type === "message" && isValidStoredMessage(payload.message)) {
        state.lastHistoryRealtimeAt = Date.now();
        appendHistoryMessage(payload.message);
        return;
      }

      if (payload && payload.type === "remove" && typeof payload.messageId === "string") {
        state.lastHistoryRealtimeAt = Date.now();
        markMessageRemoved(payload.messageId, { skipHistorySync: true, platform: payload.platform || "" });
      }
    };

    source.onerror = () => {
      if (state.historyEventSource === source) {
        source.close();
        state.historyEventSource = null;
        state.historyStreamConnected = false;
        window.setTimeout(connectHistoryStream, 3000);
      }
    };
  }

  function loadLocalBackup() {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }

      state.feedItems = parsed.filter(isValidStoredMessage);
    } catch (error) {
      state.feedItems = [];
    }
  }

  function loadRemovedMessageIds() {
    if (!shouldHideDeletedMessages()) {
      state.removedMessageIds = new Set();
      return;
    }

    try {
      const raw = window.localStorage.getItem(REMOVED_MESSAGES_STORAGE_KEY) || window.localStorage.getItem(LEGACY_REMOVED_MESSAGES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        state.removedMessageIds = new Set(parsed.filter((value) => typeof value === "string" && value.trim()));
        return;
      }
    } catch (error) {
      // Ignore corrupted removed-message cache.
    }

    state.removedMessageIds = new Set();
  }

  function persistRemovedMessageIds() {
    try {
      const values = Array.from(state.removedMessageIds).slice(-500);
      window.localStorage.setItem(REMOVED_MESSAGES_STORAGE_KEY, JSON.stringify(values));
    } catch (error) {
      // Ignore local storage quota issues for removed-message cache.
    }
  }

  function syncRemovedMessageIdsFromStorage() {
    const previous = Array.from(state.removedMessageIds).sort().join("\u001f");
    loadRemovedMessageIds();
    const next = Array.from(state.removedMessageIds).sort().join("\u001f");
    if (previous === next) {
      return;
    }

    const nextFeedItems = state.feedItems.filter((item) => !(item.messageId && state.removedMessageIds.has(item.messageId)));
    const feedChanged = nextFeedItems.length !== state.feedItems.length;
    state.feedItems = nextFeedItems;
    if (feedChanged) {
      syncLocalBackup();
      renderFeed();
      if (!state.scrollPaused) {
        scheduleScrollToLatestBurst();
      }
    }
  }

  function handleStorageChange(event) {
    if (!event) {
      return;
    }

    if (event.key === OVERLAY_SETTINGS_STORAGE_KEY || event.key === PERFORMANCE_SETTINGS_STORAGE_KEY) {
      state.overlaySettings = loadOverlaySettings();
      applyOverlaySettingsState({ skipPersist: true });
      if (state.settingsDialogOpen) {
        syncSettingsForm();
      }
      return;
    }

    if (event.key === SUPPORT_TRAIN_STORAGE_KEY) {
      syncSupportTrainFromStorage({ triggerBurst: true });
      return;
    }

    if (event.key === REMOVED_MESSAGES_STORAGE_KEY || event.key === LEGACY_REMOVED_MESSAGES_STORAGE_KEY) {
      syncRemovedMessageIdsFromStorage();
    }
  }

  async function syncOverlaySettingsFromStorage() {
    const nextSettings = (await fetchSharedOverlaySettings()) || loadOverlaySettings();
    if (getOverlaySettingsSignature(nextSettings) === getOverlaySettingsSignature(state.overlaySettings)) {
      return;
    }

    state.overlaySettings = nextSettings;
    applyOverlaySettingsState({ skipPersist: true });
    if (state.settingsDialogOpen) {
      syncSettingsForm();
    }
  }

  function persistFeed() {
    syncLocalBackup();

    const latest = state.feedItems[state.feedItems.length - 1];
    if (!latest || isLocalOnlyMode()) {
      return;
    }

    fetch(HISTORY_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latest),
    }).catch(() => {
      // Local backup already exists; server sync can recover on next message or restart.
    });
  }

  function syncLocalBackup() {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.feedItems));
      return;
    } catch (error) {
      // Fall back to a smaller history if browser storage quota is reached.
    }

    try {
      const trimmed = state.feedItems.slice(-500);
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
      state.feedItems = trimmed;
    } catch (error) {
      // If storage is unavailable, we simply skip persistence for this session.
    }
  }

  function isValidStoredMessage(value) {
    return !!value &&
      typeof value === "object" &&
      typeof value.platform === "string" &&
      typeof value.username === "string" &&
      typeof value.text === "string" &&
      typeof value.timestamp === "number" &&
      (value.giftId == null || typeof value.giftId === "string") &&
      (value.giftName == null || typeof value.giftName === "string") &&
      (value.giftImageUrl == null || typeof value.giftImageUrl === "string") &&
      (
        value.contentParts == null ||
        (
          Array.isArray(value.contentParts) &&
          value.contentParts.every((part) => part &&
            typeof part === "object" &&
            typeof part.type === "string" &&
            (part.type === "text" ? typeof part.text === "string" : true) &&
            (part.type === "emote" ? typeof part.imageUrl === "string" : true))
        )
      );
  }

  function getFeedSignature(items) {
    if (!Array.isArray(items) || !items.length) {
      return "";
    }

    return items.map((item) => [
      item.platform,
      item.variant,
      item.username,
      item.text,
      JSON.stringify(item.contentParts || []),
      item.timestamp,
      item.amountText || "",
      item.tone || "",
      item.giftId || "",
      item.giftName || "",
      item.giftImageUrl || "",
    ].join("\u001f")).join("\u001e");
  }

  function canAppendIncrementally(currentItems, nextItems) {
    if (!Array.isArray(currentItems) || !Array.isArray(nextItems)) {
      return false;
    }

    if (nextItems.length <= currentItems.length) {
      return false;
    }

    for (let index = 0; index < currentItems.length; index += 1) {
      if (getMessageSignature(currentItems[index]) !== getMessageSignature(nextItems[index])) {
        return false;
      }
    }

    return true;
  }

  function getMessageSignature(item) {
    if (!item) {
      return "";
    }

    return [
      item.platform,
      item.messageId || "",
      item.variant,
      item.username,
      item.text,
      JSON.stringify(item.contentParts || []),
      item.timestamp,
      item.amountText || "",
      item.tone || "",
      item.giftId || "",
      item.giftName || "",
      item.giftImageUrl || "",
    ].join("\u001f");
  }

  function appendHistoryMessage(message) {
    if (!isValidStoredMessage(message)) {
      return;
    }
    if (!passesFeedClearCutoff(message)) {
      return;
    }

    const signature = getMessageSignature(message);
    if (state.feedItems.some((item) => getMessageSignature(item) === signature)) {
      return;
    }

    const isVisibleMessage = shouldDisplayMessage(message);
    const shouldTrim = config.maxMessages > 0 && state.feedItems.length + 1 > config.maxMessages;
    state.feedItems.push(message);
    if (shouldTrim) {
      state.feedItems.splice(0, state.feedItems.length - config.maxMessages);
    }
    hydratePlatformStatusFromHistory();
    syncLocalBackup();
    processSupportTrainMessageItem(message);
    if (!isVisibleMessage) {
      return;
    }
    if (shouldTrim) {
      renderFeed();
    } else {
      appendMessageToFeed(message);
    }

    if (state.scrollPaused) {
      state.pausedNewCount += 1;
      updatePauseBanner();
      return;
    }

    scheduleScrollToLatestBurst();
  }

  function createMemberBadgeNode(item) {
    const badgeNode = document.createElement("span");
    badgeNode.className = "badge-pill badge-pill-member";
    badgeNode.innerHTML = `
      <span class="badge-pill-platform-icon" aria-hidden="true">${statusPlatformIconSvg(item.platform)}</span>
      <span class="badge-pill-text">${escapeHtml(item.memberLabel || getMembershipLabel(item.platform, {}))}</span>
    `;
    return badgeNode;
  }

  function renderSpecialMedia(fragment, item) {
    if (!fragment || !item) {
      return;
    }

    const mediaSpec = getSpecialMediaSpec(item);
    if (!mediaSpec) {
      return;
    }

    const card = fragment.querySelector(".message-card");
    const body = fragment.querySelector(".message-body");
    const text = fragment.querySelector(".message-text");
    if (!card || !body || !text) {
      return;
    }

    const media = document.createElement("div");
    media.className = "message-special-media";

    const imageLayer = document.createElement("div");
    imageLayer.className = "message-special-media-layer";

    const image = document.createElement("img");
    image.className = "message-special-media-image";
    image.src = mediaSpec.imageUrl;
    image.alt = mediaSpec.title;
    image.loading = "lazy";
    image.decoding = "async";
    imageLayer.appendChild(image);
    media.appendChild(imageLayer);

    const copy = document.createElement("div");
    copy.className = "message-special-media-copy";

    const title = document.createElement("div");
    title.className = "message-special-media-title";
    title.textContent = mediaSpec.title;
    copy.appendChild(title);

    media.appendChild(copy);
    card.appendChild(media);
  }

  function getSpecialMediaSpec(item) {
    if (!item || item.variant !== "special") {
      return null;
    }

    if (isSupporterStyleSpecial(item)) {
      return {
        imageUrl: MEMBER_BADGE_IMAGE,
        title: getMembershipMediaTitle(item),
      };
    }

    const resolvedKickGiftImageUrl = item.platform === "kick" && !item.giftImageUrl
      ? (() => {
          const giftById = findKickGiftById(item.giftId);
          const giftByName = giftById || findKickGiftByName(item.giftName);
          return buildKickGiftImageUrl((giftById && giftById.id) || (giftByName && giftByName.id) || item.giftId);
        })()
      : "";
    const resolvedStickerImageUrl = isYouTubeSuperStickerItem(item)
      ? resolveYouTubeSuperStickerImageUrl(item.giftId)
      : "";
    const imageUrl = item.giftImageUrl || resolvedKickGiftImageUrl || resolvedStickerImageUrl;
    if (imageUrl) {
      return {
        imageUrl,
        title: item.giftName || (isYouTubeSuperStickerItem(item) ? "Super Sticker" : "Kick Gift"),
      };
    }

    if (isMembershipStyleSpecial(item)) {
      return {
        imageUrl: MEMBER_BADGE_IMAGE,
        title: getMembershipMediaTitle(item),
      };
    }

    return null;
  }

  function hasSpecialMedia(item) {
    return !!getSpecialMediaSpec(item);
  }

  function isYouTubeSuperStickerItem(item) {
    if (!item || item.platform !== "youtube" || item.variant !== "special") {
      return false;
    }

    const badges = Array.isArray(item.badges)
      ? item.badges.map((badge) => String(badge || "").trim().toLowerCase())
      : [];
    return badges.includes("super sticker");
  }

  function getMembershipMediaTitle(item) {
    if (!item) {
      return "Member";
    }

    if (item.platform === "twitch") {
      return "Subscriber";
    }

    if (item.platform === "kick") {
      return "Supporter";
    }

    return "Member";
  }

  function isMembershipStyleSpecial(item) {
    if (!item || item.variant !== "special") {
      return false;
    }

    if (item.platform === "youtube") {
      return isYouTubeMembershipSpecial(item);
    }

    if (item.platform === "twitch") {
      return isTwitchMembershipSpecial(item);
    }

    if (item.platform === "kick") {
      return isKickMembershipSpecial(item);
    }

    return false;
  }

  function isSupporterStyleSpecial(item) {
    if (!item || item.variant !== "special") {
      return false;
    }

    return item.tone === "tone-kick-supporter" ||
      item.tone === "tone-youtube-supporter" ||
      item.tone === "tone-twitch-supporter";
  }

  function isYouTubeMembershipSpecial(item) {
    if (!item || item.platform !== "youtube" || item.variant !== "special") {
      return false;
    }

    const badges = Array.isArray(item.badges) ? item.badges.map((badge) => String(badge || "").toLowerCase()) : [];
    return badges.some((badge) =>
      badge.includes("new sponsor") ||
      badge.includes("membership gift") ||
      badge.includes("gift membership received")
    );
  }

  function isTwitchMembershipSpecial(item) {
    if (!item || item.platform !== "twitch" || item.variant !== "special") {
      return false;
    }

    const badges = Array.isArray(item.badges) ? item.badges.map((badge) => String(badge || "").toLowerCase()) : [];
    const text = String(item.text || "").toLowerCase();
    return badges.some((badge) => badge === "sub" || badge === "re sub") ||
      text.includes("subscribed on twitch");
  }

  function isKickMembershipSpecial(item) {
    if (!item || item.platform !== "kick" || item.variant !== "special") {
      return false;
    }

    const badges = Array.isArray(item.badges) ? item.badges.map((badge) => String(badge || "").toLowerCase()) : [];
    const text = String(item.text || "").toLowerCase();
    return badges.some((badge) => badge === "subscription" || badge === "resubscription") ||
      text.includes("subscribed on kick");
  }

  function appendPaidAshCanvas(fragment) {
    if (!fragment) {
      return;
    }

    const card = fragment.querySelector(".message-card");
    if (!card) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "message-paid-ash-canvas";
    card.appendChild(canvas);
  }

  function shouldRenderPaidAsh(item) {
    if (!item || item.variant !== "special") {
      return false;
    }

    if (state.liteEffects) {
      return false;
    }

    if (isTipTone(item.tone)) {
      return true;
    }

    return item.platform === "twitch" ||
      item.platform === "kick" ||
      item.platform === "youtube" ||
      item.platform === "streamlabs" ||
      item.platform === "streamelements";
  }

  function getPaidAshColor(item) {
    if (!item) {
      return { r: 255, g: 255, b: 255 };
    }

    if (isTipTone(item.tone)) {
      return { r: 255, g: 255, b: 255 };
    }

    if (item.platform === "twitch") {
      return { r: 224, g: 205, b: 255 };
    }

    if (item.platform === "kick") {
      return { r: 191, g: 255, b: 170 };
    }

    if (item.platform === "youtube") {
      if (item.tone === "tone-youtube-green") {
        return { r: 235, g: 255, b: 214 };
      }
      if (item.tone === "tone-youtube-yellow" || item.tone === "tone-youtube-orange") {
        return { r: 255, g: 228, b: 188 };
      }
      if (item.tone === "tone-youtube-magenta") {
        return { r: 255, g: 214, b: 238 };
      }
      return { r: 255, g: 214, b: 206 };
    }

    if (item.platform === "streamlabs") {
      return { r: 212, g: 245, b: 255 };
    }

    if (item.platform === "streamelements") {
      return { r: 221, g: 241, b: 255 };
    }

    return { r: 255, g: 255, b: 255 };
  }

  function setupPaidAshCanvas(container, canvas, ashColor) {
    if (!container || !canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    const particles = [];
    const particleCount = 22;
    let width = 1;
    let height = 1;
    let isDisposed = false;
    let resizeObserver = null;
    let resizeHandler = null;

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resetParticle(particle, scatter = false) {
      particle.x = -20 + Math.random() * (width * 0.42);
      particle.y = height + Math.random() * 22;
      particle.vx = 0.45 + Math.random() * 1.25;
      particle.vy = 0.6 + Math.random() * 1.55;
      particle.size = 3 + Math.random() * 6.4;
      particle.rotation = Math.random() * Math.PI * 2;
      particle.rotationVelocity = (Math.random() - 0.5) * 0.07;
      particle.alpha = 0.46 + Math.random() * 0.54;
      particle.ttl = 84 + Math.random() * 136;
      particle.age = 0;
      particle.seed = Math.random() * Math.PI * 2;

      if (scatter) {
        particle.x += Math.random() * width;
        particle.y -= Math.random() * height;
      }
    }

    function initializeParticles() {
      particles.length = 0;
      for (let index = 0; index < particleCount; index += 1) {
        const particle = {};
        resetParticle(particle, true);
        particles.push(particle);
      }
    }

    function draw() {
      if (isDisposed || !document.body.contains(canvas)) {
        isDisposed = true;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        return;
      }

      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.age += 1;
        particle.x += particle.vx + Math.sin((particle.age * 0.052) + particle.seed) * 0.35;
        particle.y -= particle.vy + Math.cos((particle.age * 0.04) + particle.seed) * 0.16;
        particle.rotation += particle.rotationVelocity;

        if (particle.x > width + 30 || particle.y < -26 || particle.age > particle.ttl) {
          resetParticle(particle, false);
        }

        const lifeFade = 1 - (particle.age / particle.ttl);
        const alpha = Math.max(0, particle.alpha * lifeFade);
        if (alpha <= 0.015) {
          continue;
        }

        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = `rgba(${ashColor.r}, ${ashColor.g}, ${ashColor.b}, ${alpha.toFixed(3)})`;
        const widthScale = particle.size * (0.8 + Math.random() * 0.8);
        const heightScale = particle.size * (0.34 + Math.random() * 0.5);
        context.beginPath();
        context.moveTo(-widthScale * 0.6, -heightScale * 0.2);
        context.lineTo(widthScale * 0.65, -heightScale * 0.45);
        context.lineTo(widthScale * 0.4, heightScale * 0.55);
        context.lineTo(-widthScale * 0.7, heightScale * 0.35);
        context.closePath();
        context.fill();
        context.restore();
      }

      window.requestAnimationFrame(draw);
    }

    resize();
    initializeParticles();
    draw();
    resizeHandler = () => {
      if (!isDisposed) {
        resize();
      }
    };
    window.addEventListener("resize", resizeHandler, { passive: true });
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    registerCardCleanup(container, () => {
      isDisposed = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
      }
      if (canvas.parentNode) {
        canvas.remove();
      }
    });
  }

  function getDisplayAmountText(item) {
    if (isGiftRecipientSpecial(item)) {
      return "";
    }

    if (!item || typeof item.amountText !== "string") {
      if (item && item.platform === "kick" && item.tone === "tone-kick-gift") {
        const kickGiftEntry = findKickGiftById(item.giftId) || findKickGiftByName(item.giftName);
        const fallbackAmount = getKickGiftCatalogAmount(kickGiftEntry);
        return Number.isFinite(fallbackAmount) ? formatPlainNumber(fallbackAmount) : "";
      }
      if (item && (
        (item.platform === "kick" && item.tone === "tone-kick-supporter") ||
        item.tone === "tone-youtube-supporter" ||
        item.tone === "tone-twitch-supporter"
      )) {
        return "SUPPORTER";
      }
      return "";
    }

    if (
      (item.platform === "kick" && item.tone === "tone-kick-supporter") ||
      item.tone === "tone-youtube-supporter" ||
      item.tone === "tone-twitch-supporter"
    ) {
      return "SUPPORTER";
    }

    if (item.platform === "kick" && item.tone === "tone-kick-gift") {
      const normalizedAmountText = item.amountText
        .replace(/\s*kicks?\s*$/i, "")
        .replace(/\s*subs?\s*$/i, "")
        .trim();
      if (normalizedAmountText) {
        const numeric = normalizedAmountText.match(/[\d,.]+/);
        return numeric ? numeric[0] : normalizedAmountText;
      }
      const kickGiftEntry = findKickGiftById(item.giftId) || findKickGiftByName(item.giftName);
      const fallbackAmount = getKickGiftCatalogAmount(kickGiftEntry);
      return Number.isFinite(fallbackAmount) ? formatPlainNumber(fallbackAmount) : "";
    }

    if (item.platform === "kick" && item.tone === "tone-kick-kicks") {
      return item.amountText.replace(/\s*kicks?\s*$/i, "").trim();
    }

    if (item.platform === "twitch" && /\s*bits?\s*$/i.test(item.amountText)) {
      return item.amountText.replace(/\s*bits?\s*$/i, "").trim();
    }

    if ((item.platform === "twitch" || item.platform === "kick") && /\s*subs?\s*$/i.test(item.amountText)) {
      const normalized = item.amountText.replace(/\s*subs?\s*$/i, "").trim();
      if (item.platform === "kick") {
        const numeric = normalized.match(/[\d,.]+/);
        return numeric ? numeric[0] : normalized;
      }
      return normalized;
    }

    if (
      item.platform === "youtube" &&
      typeof item.text === "string" &&
      /super sticker/i.test(item.text) &&
      /^[L?](?=\d)/.test(item.amountText)
    ) {
      return item.amountText.replace(/^[L?](?=\d)/, "£");
    }

    return item.amountText;
  }

  function renderAmountContent(container, item) {
    if (!container) {
      return;
    }

    const amountText = getDisplayAmountText(item);
    container.innerHTML = "";
    container.classList.remove("message-amount-with-icon");

    const value = document.createElement("span");
    value.className = "message-amount-value";
    value.textContent = amountText;
    container.appendChild(value);

    const unitLabel = getAmountUnitLabel(item);
    if (unitLabel) {
      container.classList.add("message-amount-with-icon");
      const unit = document.createElement("span");
      unit.className = "message-amount-unit";
      unit.textContent = unitLabel;
      container.appendChild(unit);
    }
  }

  function getAmountUnitLabel(item) {
    if (!item || item.variant !== "special") {
      return "";
    }

    if (
      item.platform === "kick" &&
      !(typeof item.amountText === "string" && /\s*subs?\s*$/i.test(item.amountText))
    ) {
      return "";
    }

    const badges = Array.isArray(item.badges)
      ? item.badges.map((badge) => String(badge || "").trim().toLowerCase())
      : [];
    const text = String(item.text || "").trim().toLowerCase();

    if (
      badges.includes("gifted sub") ||
      badges.includes("gift bomb") ||
      badges.includes("gifted membership") ||
      /gifted subs?\b/i.test(text) ||
      /gifted memberships?\b/i.test(text)
    ) {
      return "SUBS";
    }

    return "";
  }

  function isGiftRecipientSpecial(item) {
    if (!item || item.variant !== "special") {
      return false;
    }

    const text = String(item.text || "").toLowerCase();
    return text.includes("received a gifted membership") ||
      text.includes("received a gifted twitch sub") ||
      text.includes("received a gifted kick sub");
  }

  function getKickGiftScaleClass(item) {
    if (!item || item.platform !== "kick" || item.tone !== "tone-kick-gift") {
      return "";
    }

    const numericAmount = Number(String(getDisplayAmountText(item) || "").replace(/,/g, "").trim());
    if (!Number.isFinite(numericAmount)) {
      return "";
    }

    if (numericAmount >= 5000) {
      return "kick-gift-high";
    }
    if (numericAmount <= 100) {
      return "kick-gift-low";
    }

    return "";
  }

  function getKickGiftAmountLayoutClass(item) {
    if (!item || item.platform !== "kick" || item.tone !== "tone-kick-gift") {
      return "";
    }

    const numericAmount = Number(String(getDisplayAmountText(item) || "").replace(/,/g, "").trim());
    if (!Number.isFinite(numericAmount)) {
      return "";
    }

    return numericAmount <= 100 ? "kick-gift-amount-tight" : "kick-gift-amount-wide";
  }

  function getLoopBackgroundWord(item) {
    if (!item || item.variant !== "special") {
      return "";
    }

    if (isGiftRecipientSpecial(item)) {
      return "SUBS";
    }

    if (item.platform === "twitch" && typeof item.amountText === "string" && /\s*bits?\s*$/i.test(item.amountText)) {
      return "BITS";
    }

    if ((item.platform === "twitch" || item.platform === "kick") && typeof item.amountText === "string" && /\s*subs?\s*$/i.test(item.amountText)) {
      return "SUBS";
    }

    if (item.platform === "youtube" && typeof item.text === "string" && /gifted memberships?/i.test(item.text)) {
      return "SUBS";
    }

    if (item.platform === "kick" && (item.tone === "tone-kick-gift" || item.tone === "tone-kick-kicks")) {
      return "KICKS";
    }

    return "";
  }

  function renderMessageText(container, item) {
    if (!container) {
      return;
    }

    container.textContent = "";
    const parts = Array.isArray(item && item.contentParts) ? item.contentParts : [];
    if (!parts.length) {
      container.textContent = item && typeof item.text === "string" ? item.text : "";
      return;
    }

    for (const part of parts) {
      if (!part) {
        continue;
      }

      if (part.type === "emote" && typeof part.imageUrl === "string" && part.imageUrl.trim()) {
        const image = document.createElement("img");
        image.className = "message-text-emote";
        image.src = part.imageUrl;
        image.alt = part.text || "emote";
        image.title = part.text || "emote";
        image.loading = "lazy";
        image.decoding = "async";
        container.appendChild(image);
        continue;
      }

      container.appendChild(document.createTextNode(String(part.text || "")));
    }
  }

  function isEmoteOnlyMessage(item) {
    const parts = Array.isArray(item && item.contentParts) ? item.contentParts : [];
    if (!parts.length) {
      return false;
    }

    let hasEmote = false;
    for (const part of parts) {
      if (!part) {
        continue;
      }

      if (part.type === "emote" && typeof part.imageUrl === "string" && part.imageUrl.trim()) {
        hasEmote = true;
        continue;
      }

      if (part.type === "text" && String(part.text || "").trim()) {
        return false;
      }
    }

    return hasEmote;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function hydratePlatformStatusFromHistory() {
    for (const key of Object.keys(state.platforms)) {
      if (key === "streamerbot") {
        continue;
      }

      const latest = findLatestMessageForPlatform(key);
      if (!latest) {
        continue;
      }

      state.platforms[key].lastMessageAt = latest.timestamp;
      state.platforms[key].chatConfirmed = true;
      if (["streamelements", "streamlabs", "kofi", "fourthwall"].includes(key)) {
        state.platforms[key].accountConnected = true;
        state.platforms[key].connected = true;
      }
    }

    persistPlatformRuntimeState();
  }

  function findLatestMessageForPlatform(platformKey) {
    for (let index = state.feedItems.length - 1; index >= 0; index -= 1) {
      const item = state.feedItems[index];
      if (item && item.platform === platformKey && typeof item.timestamp === "number") {
        return item;
      }
    }
    return null;
  }

  function openModerationDialog(item, actionKey) {
    if (!config.showModerationControls || !ui.moderationModalBackdrop || !ui.moderationModalText) {
      return;
    }

    const plan = getModerationPlan(item, actionKey);
    if (!plan) {
      showToast("This moderation action is not available for this message.", "danger");
      return;
    }

    state.moderationDialog = { item, ...plan };
    state.moderationBusy = false;
    ui.moderationModalText.textContent = plan.confirmationText;
    ui.moderationModalConfirm.textContent = plan.confirmLabel;
    ui.moderationModalConfirm.disabled = false;
    ui.moderationModalBackdrop.classList.remove("hidden");
    ui.moderationModalBackdrop.setAttribute("aria-hidden", "false");
  }

  function closeModerationDialog() {
    state.moderationDialog = null;
    state.moderationBusy = false;
    if (!ui.moderationModalBackdrop) {
      return;
    }
    ui.moderationModalBackdrop.classList.add("hidden");
    ui.moderationModalBackdrop.setAttribute("aria-hidden", "true");
    if (ui.moderationModalConfirm) {
      ui.moderationModalConfirm.disabled = false;
      ui.moderationModalConfirm.textContent = "Confirm";
    }
  }

  function getModerationPlan(item, actionKey) {
    if (!item || !item.platform || !item.username) {
      return null;
    }

    const platformLabel = PLATFORM_META[item.platform] ? PLATFORM_META[item.platform].label : item.platform;
    if (actionKey === "delete") {
      if (!item.messageId || !config.moderationDeleteAction) {
        return null;
      }
      return {
        actionKey,
        actionName: config.moderationDeleteAction,
        confirmLabel: "Delete",
        confirmationText: `Delete this ${platformLabel} message from ${item.username}?`,
      };
    }

    if (actionKey === "pin") {
      if (!item.messageId || !config.moderationPinAction) {
        return null;
      }
      return {
        actionKey,
        actionName: config.moderationPinAction,
        confirmLabel: "Pin",
        confirmationText: `Pin this ${platformLabel} message from ${item.username}?`,
      };
    }

    if (actionKey === "timeout") {
      if (!config.moderationTimeoutAction) {
        return null;
      }
      const seconds = Number.isFinite(config.moderationTimeoutSeconds) ? Math.max(1, Math.round(config.moderationTimeoutSeconds)) : 600;
      return {
        actionKey,
        actionName: config.moderationTimeoutAction,
        confirmLabel: "Timeout",
        confirmationText: `Timeout ${item.username} on ${platformLabel} for ${seconds} seconds?`,
      };
    }

    if (actionKey === "ban") {
      if (!config.moderationBanAction) {
        return null;
      }
      return {
        actionKey,
        actionName: config.moderationBanAction,
        confirmLabel: "Ban",
        confirmationText: `Ban ${item.username} on ${platformLabel}?`,
      };
    }

    return null;
  }

  async function confirmModerationDialog() {
    if (!state.moderationDialog || state.moderationBusy) {
      return;
    }

    const { item, actionKey, actionName } = state.moderationDialog;
    if (!actionName) {
      showToast("No Streamer.bot action name is configured for this moderation button.", "danger");
      closeModerationDialog();
      return;
    }

    state.moderationBusy = true;
    if (ui.moderationModalConfirm) {
      ui.moderationModalConfirm.disabled = true;
      ui.moderationModalConfirm.textContent = "Working...";
    }

    const args = {
      platform: item.platform || "",
      username: item.username || "",
      userId: item.userId || "",
      messageId: item.messageId || "",
      text: item.text || "",
      variant: item.variant || "",
      timeoutSeconds: String(Number.isFinite(config.moderationTimeoutSeconds) ? Math.max(1, Math.round(config.moderationTimeoutSeconds)) : 600),
    };

    try {
      await sendRequest("DoAction", {
        action: { name: actionName },
        actionName,
        args,
      }, { timeoutMs: config.requestTimeoutMs + 4000 });

      if (actionKey === "delete" && item.messageId) {
        markMessageRemoved(item.messageId);
      }

      showToast(`${formatModerationActionLabel(actionKey)} sent for ${item.username}.`, "ok");
      closeModerationDialog();
    } catch (error) {
      showToast(`Moderation failed: ${error.message}`, "danger");
      closeModerationDialog();
    }
  }

  function formatModerationActionLabel(actionKey) {
    if (actionKey === "delete") {
      return "Delete message";
    }
    if (actionKey === "pin") {
      return "Pin message";
    }
    if (actionKey === "timeout") {
      return "Timeout";
    }
    if (actionKey === "ban") {
      return "Ban";
    }
    return "Moderation";
  }

  function getDockSendPlatforms() {
    return ["twitch", "kick", "youtube"].filter((platformKey) => config.enabledPlatforms.includes(platformKey));
  }

  function getPreferredDockSendPlatform() {
    const availablePlatforms = getDockSendPlatforms();
    if (!availablePlatforms.length) {
      return "";
    }

    for (const platformKey of availablePlatforms) {
      const platformState = state.platforms[platformKey];
      if (platformState && platformState.connected) {
        return platformKey;
      }
    }

    return availablePlatforms[0];
  }

  function renderDockComposer() {
    if (!ui.dockComposer || !ui.dockComposerPlatform || !ui.dockComposerButton || !ui.dockComposerInput) {
      return;
    }

    const shouldShow = !!config.showModerationControls;
    ui.dockComposer.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) {
      return;
    }

    const platforms = getDockSendPlatforms();
    const currentValue = ui.dockComposerPlatform.value;
    ui.dockComposerPlatform.innerHTML = "";

    if (platforms.length > 1) {
      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "All Chat";
      ui.dockComposerPlatform.appendChild(allOption);
    }

    for (const platformKey of platforms) {
      const option = document.createElement("option");
      option.value = platformKey;
      option.textContent = PLATFORM_META[platformKey] ? PLATFORM_META[platformKey].label : platformKey;
      ui.dockComposerPlatform.appendChild(option);
    }

    const validValues = platforms.length > 1 ? ["all", ...platforms] : [...platforms];
    const preferredValue = validValues.includes(currentValue)
      ? currentValue
      : (platforms.length > 1 ? "all" : getPreferredDockSendPlatform());
    if (preferredValue) {
      ui.dockComposerPlatform.value = preferredValue;
    }

    const disabled = state.sendMessageBusy || !platforms.length || !config.sendMessageAction;
    ui.dockComposerPlatform.disabled = disabled;
    ui.dockComposerInput.disabled = state.sendMessageBusy || !config.sendMessageAction;
    ui.dockComposerButton.disabled = disabled;
    ui.dockComposerInput.placeholder = config.sendMessageAction
      ? "Send a message from the dock"
      : "Configure sendMessageAction to enable dock sending";
  }

  async function submitDockMessage(event) {
    if (event) {
      event.preventDefault();
    }

    if (!config.showModerationControls || state.sendMessageBusy) {
      return;
    }

    if (!config.sendMessageAction) {
      showToast("No Streamer.bot action name is configured for dock message sending.", "danger");
      renderDockComposer();
      return;
    }

    const messageText = ui.dockComposerInput ? String(ui.dockComposerInput.value || "").trim() : "";
    const platform = ui.dockComposerPlatform ? String(ui.dockComposerPlatform.value || "").trim().toLowerCase() : "";
    if (!messageText) {
      showToast("Type a message before sending.", "danger");
      return;
    }
    if (!platform) {
      showToast("Choose a platform to send the message.", "danger");
      return;
    }

    state.sendMessageBusy = true;
    renderDockComposer();
    if (ui.dockComposerButton) {
      ui.dockComposerButton.textContent = "Sending...";
    }

    try {
      await sendRequest("DoAction", {
        action: { name: config.sendMessageAction },
        actionName: config.sendMessageAction,
        args: {
          platform,
          platforms: platform === "all" ? getDockSendPlatforms().join(",") : platform,
          text: messageText,
          message: messageText,
          source: "dock",
        },
      }, { timeoutMs: config.requestTimeoutMs + 4000 });

      if (ui.dockComposerInput) {
        ui.dockComposerInput.value = "";
        ui.dockComposerInput.focus();
      }
      showToast(`Message sent to ${PLATFORM_META[platform] ? PLATFORM_META[platform].label : platform}.`, "ok");
    } catch (error) {
      showToast(`Send failed: ${error.message}`, "danger");
    } finally {
      state.sendMessageBusy = false;
      if (ui.dockComposerButton) {
        ui.dockComposerButton.textContent = "Send";
      }
      renderDockComposer();
    }
  }

  function buildOverlayTestCatalog() {
    const stamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).replace(/[^0-9]/g, "");
    const now = Date.now();
    return {
      "twitch-follow": {
        platform: "twitch",
        variant: "special",
        username: `DockTwitchFollow${stamp}`,
        text: "started following",
        badges: ["Follow"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-follow-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 1,
      },
      "kick-follow": {
        platform: "kick",
        variant: "special",
        username: `DockKickFollow${stamp}`,
        text: "started following",
        badges: ["Follow"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-follow-kick",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 2,
      },
      "kick-raid": {
        platform: "kick",
        variant: "special",
        username: `DockKickRaid${stamp}`,
        text: "raided with GreenWave 33 viewers",
        badges: ["Raid"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-raid-kick",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 3,
      },
      "youtube-sub": {
        platform: "youtube",
        variant: "special",
        username: `DockYTSub${stamp}`,
        text: "subscribed on YouTube",
        badges: ["Subscriber"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-follow-youtube",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 5,
      },
      "youtube-sticker": {
        platform: "youtube",
        variant: "special",
        username: `DockSticker${stamp}`,
        text: "sent a Super Sticker",
        badges: ["Super Sticker"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "$24.00",
        tone: "tone-youtube-orange",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "pearfect_lol_v2",
        giftName: "HA HA HA",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 6,
      },
      "twitch-raid": {
        platform: "twitch",
        variant: "special",
        username: `DockRaid${stamp}`,
        text: "raided with RaidRunner 47 viewers",
        badges: ["Raid"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-raid-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 7,
      },
      "twitch-hype": {
        platform: "twitch",
        variant: "special",
        username: `DockHype${stamp}`,
        text: "reached Hype Train level 4 82%",
        badges: ["Hype Train"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-hypetrain-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8,
      },
      "twitch-bits": {
        platform: "twitch",
        variant: "special",
        username: `DockBits${stamp}`,
        text: "sent bits",
        badges: ["Cheer"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "1500 Bits",
        tone: "tone-bits-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8.1,
      },
      "twitch-sub": {
        platform: "twitch",
        variant: "member",
        username: `DockSub${stamp}`,
        text: "This is a Twitch subscriber chat message test.",
        badges: ["Subscriber"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "",
        memberLabel: "Subscriber",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8.2,
      },
      "twitch-gifts": {
        platform: "twitch",
        variant: "special",
        username: `DockGiftBomb${stamp}`,
        text: "gifted subs to the community",
        badges: ["Gift Bomb"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "10 Subs",
        tone: "tone-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8.3,
      },
      "twitch-giftrecipient": {
        platform: "twitch",
        variant: "special",
        username: `DockGiftedViewer${stamp}`,
        text: "received a gifted Twitch sub",
        badges: ["Gifted Sub"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-twitch-supporter",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8.35,
      },
      "twitch-supporter": {
        platform: "twitch",
        variant: "special",
        username: `DockSupporter${stamp}`,
        text: "just became a Twitch supporter",
        badges: ["Subscriber"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-twitch-supporter",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 8.36,
      },
      "support-store": {
        platform: "streamlabs",
        variant: "special",
        username: `DockStore${stamp}`,
        text: "redeemed Hoodie x2",
        badges: ["Store Redeem"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "$59.99",
        tone: "tone-redeem-streamlabs",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 9,
      },
      "twitch-redeem": {
        platform: "twitch",
        variant: "special",
        username: `DockRedeem${stamp}`,
        text: "redeemed Hydrate",
        badges: ["Redeem"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-redeem-twitch",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 10,
      },
      "kick-redeem": {
        platform: "kick",
        variant: "special",
        username: `DockKickRedeem${stamp}`,
        text: "redeemed Camera Zoom",
        badges: ["Redeem"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-redeem-kick",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 11,
      },
      "kick-sub": {
        platform: "kick",
        variant: "member",
        username: `DockKickSub${stamp}`,
        text: "This is a Kick supporter chat message test.",
        badges: ["Supporter"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "",
        memberLabel: "Supporter",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 11.1,
      },
      "kick-giftbomb": {
        platform: "kick",
        variant: "special",
        username: `DockKickBomb${stamp}`,
        text: "gifted subs to the chat",
        badges: ["Gift Bomb"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "10 Subs",
        tone: "tone-kick-gift",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 11.2,
      },
      "kick-giftrecipient": {
        platform: "kick",
        variant: "special",
        username: `DockKickGiftedViewer${stamp}`,
        text: "received a gifted Kick sub",
        badges: ["Gifted Sub"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-kick-supporter",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 11.25,
      },
      "kick-supporter": {
        platform: "kick",
        variant: "special",
        username: `DockKickSupporter${stamp}`,
        text: "just became a Kick supporter",
        badges: ["Supporter"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-kick-supporter",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 11.26,
      },
      "kick-gift": {
        platform: "kick",
        variant: "special",
        username: `DockKickGift${stamp}`,
        text: "sent Flex",
        badges: ["Flex"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "10,000",
        tone: "tone-kick-gift",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "flex",
        giftName: "Flex",
        giftImageUrl: "https://files.kick.com/kicks/gifts/flex.webp",
        contentParts: [],
        timestamp: now + 12,
      },
      "youtube-superchat": {
        platform: "youtube",
        variant: "special",
        username: `DockSuperChat${stamp}`,
        text: "sent a Super Chat",
        badges: ["Super Chat"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "$49.99",
        tone: "tone-youtube-magenta",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 12.1,
      },
      "youtube-member": {
        platform: "youtube",
        variant: "special",
        username: `DockMember${stamp}`,
        text: "became a member",
        badges: ["Supporter"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-youtube-supporter",
        memberLabel: "Supporter",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 12.2,
      },
      "youtube-membergift": {
        platform: "youtube",
        variant: "special",
        username: `DockGiftedMember${stamp}`,
        text: "gifted memberships",
        badges: ["Gifted Membership"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "5",
        tone: "tone-youtube-red",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 12.3,
      },
      "youtube-memberrecipient": {
        platform: "youtube",
        variant: "special",
        username: `DockGiftRecipient${stamp}`,
        text: "received a gifted membership",
        badges: ["Gifted Membership"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "tone-youtube-green",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 12.35,
      },
      "youtube-memberchat": {
        platform: "youtube",
        variant: "member",
        username: `DockMemberChat${stamp}`,
        text: "This is a member chat message test.",
        badges: [],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "",
        tone: "",
        memberLabel: "Member",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 12.4,
      },
      "support-tip": {
        platform: "streamelements",
        variant: "special",
        username: `DockTip${stamp}`,
        text: "Keep the stream rolling!",
        badges: ["Tip"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "$12.50",
        tone: "tone-tip-yellow",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 13,
      },
      "streamlabs-donation": {
        platform: "streamlabs",
        variant: "special",
        username: `DockDonation${stamp}`,
        text: "sent a donation",
        badges: ["Donation"],
        color: null,
        avatarUrl: "",
        isBroadcaster: false,
        amountText: "$27.00",
        tone: "tone-tip-orange",
        memberLabel: "",
        messageId: "",
        userId: "",
        giftId: "",
        giftName: "",
        giftImageUrl: "",
        contentParts: [],
        timestamp: now + 13.1,
      },
    };
  }

  function buildOverlayTestMessages(keys) {
    const catalog = buildOverlayTestCatalog();
    const normalizedKeys = Array.isArray(keys) ? keys : [];
    const messages = [];
    for (const key of normalizedKeys) {
      if (!key || !catalog[key]) {
        continue;
      }
      messages.push({ ...catalog[key] });
    }
    return messages;
  }

  async function triggerOverlayTestBatch(keys, label = "Test alerts") {
    if (!config.showModerationControls || state.testAlertsBusy) {
      return;
    }

    const normalizedKeys = Array.isArray(keys) && keys.length
      ? keys
      : ["twitch-follow", "kick-follow", "youtube-sub", "youtube-sticker", "twitch-redeem", "kick-redeem"];

    state.testAlertsBusy = true;
    for (const button of ui.settingsTestActions) {
      button.disabled = true;
    }

    try {
      const messages = buildOverlayTestMessages(normalizedKeys);
      for (const message of messages) {
        if (!isLocalOnlyMode()) {
          const response = await fetch(HISTORY_API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
          });
          if (!response.ok) {
            throw new Error(`Test alert failed with ${response.status}`);
          }
        }

        appendHistoryMessage(message);
      }

      showToast(`${label} sent.`, "ok");
    } catch (error) {
      showToast(`${label} failed: ${error.message}`, "danger");
    } finally {
      state.testAlertsBusy = false;
      for (const button of ui.settingsTestActions) {
        button.disabled = false;
      }
    }
  }

  function buildTrainTestScenario(stepIndex) {
    const scenarios = [
      {
        platformKey: "kick",
        type: "GiftPulse",
        data: {
          giftAmount: 500,
          giftName: "Rage Quit",
          user: { name: "KickTrainUser" },
        },
      },
      {
        platformKey: "streamelements",
        type: "Tip",
        data: {
          username: "LucidPayUser",
          amount: 20,
          currencyCode: "USD",
          message: "Keep it rolling!",
        },
      },
      {
        platformKey: "youtube",
        type: "SuperSticker",
        data: {
          authorDisplayName: "StickerTrainUser",
          amount: "EUR 30.00",
          tier: 6,
          stickerId: "pearfect_hows_it_going_v2",
          altText: "HOW'S IT GOING?",
          microAmount: 30000000,
          currencyCode: "EUR",
        },
      },
      {
        platformKey: "twitch",
        type: "Cheer",
        data: {
          userName: "BitTrainUser",
          bits: 3000,
        },
      },
      {
        platformKey: "kick",
        type: "MassGiftSubscription",
        data: {
          user: { name: "GiftBombTrainUser" },
          gifted: 10,
        },
      },
    ];

    return scenarios[stepIndex % scenarios.length];
  }

  async function injectOverlayTestMessage(message) {
    if (!message) {
      return;
    }

    if (window.location.protocol !== "file:") {
      const response = await fetch(HISTORY_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        throw new Error(`Test alert failed with ${response.status}`);
      }
    }

    appendHistoryMessage(message);
  }

  async function triggerOverlayTrainStep() {
    if (!config.showModerationControls || state.trainTestBusy) {
      return;
    }

    state.trainTestBusy = true;
    if (ui.settingsTrainStep) {
      ui.settingsTrainStep.disabled = true;
      ui.settingsTrainStep.textContent = "Adding...";
    }

    try {
      const scenario = buildTrainTestScenario(state.trainTestStepIndex);
      state.trainTestStepIndex += 1;
      const message = buildSpecialMessage(scenario.platformKey, scenario.type, scenario.data);
      if (!message) {
        throw new Error("Train scenario could not be built");
      }

      message.messageId = `train-step:${scenario.platformKey}:${scenario.type}:${Date.now()}`;
      message.userId = message.messageId;
      message.timestamp = Date.now();

      await injectOverlayTestMessage(message);
      processSupportTrainEvent(scenario.platformKey, scenario.type, scenario.data, message);
      showToast("Train step added.", "ok");
    } catch (error) {
      showToast(`Train step failed: ${error.message}`, "danger");
    } finally {
      state.trainTestBusy = false;
      if (ui.settingsTrainStep) {
        ui.settingsTrainStep.disabled = false;
        ui.settingsTrainStep.textContent = "Train Step";
      }
    }
  }

  function resetSupportTrainForTesting() {
    state.trainTestStepIndex = 0;
    resetSupportTrain(state.supportTrain);
    showToast("Support Train reset.", "ok");
  }

  function showToast(text, kind) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.toasts.unshift({ id, text, kind });
    if (state.toasts.length > 3) {
      state.toasts.length = 3;
    }
    renderToasts();

    window.setTimeout(() => {
      state.toasts = state.toasts.filter((toast) => toast.id !== id);
      renderToasts();
    }, config.toastDurationMs);
  }

  function renderToasts() {
    ui.toastStack.innerHTML = "";

    for (const toast of state.toasts) {
      const node = document.createElement("div");
      node.className = `status-toast toast-${toast.kind || "ok"}`;
      node.textContent = toast.text;
      ui.toastStack.appendChild(node);
    }
  }

  function toRgba(hexColor, alpha) {
    const hex = hexColor.replace("#", "");
    const normalized = hex.length === 3 ? hex.split("").map((character) => `${character}${character}`).join("") : hex;
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function readableLabelColor(platformKey) {
    return platformKey === "kick" ? "#193100" : "var(--text-main)";
  }

  function isYouTubeChatEvidence(type) {
    return ["Message", "SuperChat", "SuperSticker", "PresentViewers", "StatisticsUpdated", "BroadcastMonitoringStarted", "BroadcastStarted"].includes(type);
  }

  function getInitials(name) {
    const clean = String(name || "?").trim();
    if (!clean) {
      return "?";
    }
    return clean.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  }

  function getInitial(name) {
    const clean = String(name || "?").trim();
    return (clean[0] || "?").toUpperCase();
  }

  function renderMessageIcons(item) {
    const icons = item.platform === "streamelements" ? [] : [platformIconSvg(item.platform)];
    const badgeIcons = Array.isArray(item.badges)
      ? item.badges.map((badge) => renderBadgeIcon(badge)).filter(Boolean)
      : [];

    icons.push(...badgeIcons);

    if (item.isBroadcaster) {
      icons.push(broadcasterIconSvg());
    }
    return icons.join("");
  }

  function renderBadgeIcon(badge) {
    const normalized = String(badge || "").trim().toLowerCase();
    if (!normalized || normalized === "broadcaster") {
      return "";
    }

    if (isMemberBadge(normalized)) {
      return memberBadgeIconSvg();
    }

    if (isModeratorBadge(normalized)) {
      return moderatorBadgeIconSvg();
    }

    if (isVerifiedBadge(normalized)) {
      return verifiedBadgeIconSvg();
    }

    return "";
  }

  function isMemberBadge(normalized) {
    return [
      "subscriber",
      "sub",
      "subscriber badge",
      "member",
      "membership",
      "founder",
      "premium",
      "premium subscriber",
      "sponsor",
    ].some((value) => normalized.includes(value));
  }

  function isModeratorBadge(normalized) {
    return normalized === "moderator" || normalized === "mod";
  }

  function isVerifiedBadge(normalized) {
    return normalized === "verified" || normalized === "verified channel" || normalized === "verified_channel";
  }

  function shouldRenderBadgePill(badge) {
    const normalized = String(badge || "").trim().toLowerCase();
    if (!normalized || normalized === "broadcaster") {
      return false;
    }

    return !renderBadgeIcon(normalized);
  }

  function platformIconSvg(platformKey) {
    const svgs = {
      twitch: '<span class="message-icon" title="Twitch"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 3h16v11l-4 4h-4l-3 3v-3H4V3Z" fill="#9146FF"/><path d="M10 8v5M15 8v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></span>',
      youtube: '<span class="message-icon" title="YouTube"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000"/><path d="M10 9.2 15.5 12 10 14.8V9.2Z" fill="#fff"/></svg></span>',
      kick: '<span class="message-icon" title="Kick"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#53FC18"/><path d="M8 6h3v5h2l3-5h3l-4 6 4 6h-3l-3-5h-2v5H8V6Z" fill="#091100"/></svg></span>',
      streamlabs: '<span class="message-icon" title="Streamlabs"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4" fill="#38BDF8"/><path d="M8 10h8v4H8z" fill="#fff"/></svg></span>',
      streamelements: `<span class="message-icon" title="StreamElements / LucidPay"><img class="message-icon-image" src="${LUCIDPAY_STATUS_ICON}" alt="LucidPay icon"></span>`,
      kofi: '<span class="message-icon" title="Ko-fi"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h10a4 4 0 0 1 0 8H7a2 2 0 0 1-2-2V7Z" fill="#FF5E5B"/><path d="M15 9h2a2 2 0 1 1 0 4h-2" stroke="#fff" stroke-width="2"/></svg></span>',
      fourthwall: '<span class="message-icon" title="Fourthwall"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#F4A261"/><path d="M8 8h8v8H8z" fill="#fff"/></svg></span>',
    };
    return svgs[platformKey] || "";
  }

  function statusPlatformIconSvg(platformKey) {
    const svgs = {
      streamerbot: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="9" fill="#081014"/><path d="M8.2 7.4h4.5a3.2 3.2 0 0 1 0 6.4h-2.4v2.8H8.2V7.4Zm2.1 1.9v2.6h2.1a1.3 1.3 0 1 0 0-2.6h-2.1Zm5.2-1.9h2.1v9.2h-2.1V7.4Z" fill="#D8F7FF"/></svg>',
      twitch: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 3h16v11l-4 4h-4l-3 3v-3H4V3Z" fill="#9146FF"/><path d="M10 8v5M15 8v5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000"/><path d="M10 9.2 15.5 12 10 14.8V9.2Z" fill="#fff"/></svg>',
      kick: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#53FC18"/><path d="M8 6h3v5h2l3-5h3l-4 6 4 6h-3l-3-5h-2v5H8V6Z" fill="#091100"/></svg>',
      streamelements: `<img class="status-icon-image" src="${LUCIDPAY_STATUS_ICON}" alt="LucidPay icon">`,
    };
    return svgs[platformKey] || `<span>${(PLATFORM_META[platformKey] && PLATFORM_META[platformKey].short) || "?"}</span>`;
  }

  function broadcasterIconSvg() {
    return '<span class="message-icon message-icon-broadcaster" title="Broadcaster"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 2.4 4.9 5.4.8-3.9 3.8.9 5.5L12 14.8 7.2 17l.9-5.5L4.2 7.7l5.4-.8L12 2Z"/></svg></span>';
  }

  function memberBadgeIconSvg() {
    return `<span class="message-icon" title="Member"><img class="message-icon-image" src="${MEMBER_BADGE_IMAGE}" alt="Member badge"></span>`;
  }

  function moderatorBadgeIconSvg() {
    return '<span class="message-icon message-icon-moderator" title="Moderator"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.8 5.2a2 2 0 0 1 2.8 2.8l-1.1 1.1 1.3 1.3a1 1 0 1 1-1.4 1.4l-1.3-1.3-4.9 4.9a3 3 0 0 1-1.3.8l-2.8.8.8-2.8a3 3 0 0 1 .8-1.3l4.9-4.9-1.3-1.3a1 1 0 0 1 1.4-1.4l1.3 1.3 1.1-1.1Z" fill="currentColor"/></svg></span>';
  }

  function verifiedBadgeIconSvg() {
    return '<span class="message-icon message-icon-verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 14.4 5l2.8-.2 1.3 2.4 2.4 1.3-.2 2.8 1.5 2.4-1.5 2.4.2 2.8-2.4 1.3-1.3 2.4-2.8-.2-2.4 1.5-2.4-1.5-2.8.2-1.3-2.4-2.4-1.3.2-2.8L3.5 14l1.5-2.4-.2-2.8 2.4-1.3L8.5 5l2.8.2L12 3.5Z" fill="currentColor"/><path d="m8.8 12.2 2.1 2.1 4.4-4.5" stroke="#05131f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function initialize() {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    applyOverlaySettingsState({ skipPersist: true });
    state.supportTrain = loadPersistedSupportTrain();
    loadRemovedMessageIds();
    renderStatusItems();
    renderStatus();
    renderSupportTrainHud();
    renderPerformanceControls();
    syncSettingsForm();
    renderDockComposer();
    updatePauseBanner();
    initRuntimeSyncChannel();
    window.addEventListener("offline", handleBrowserOffline);
    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("focus", handlePageResume, { passive: true });
    window.addEventListener("error", (event) => {
      debugRuntimeIssue("window-error", {
        message: event && event.message ? event.message : "Unknown error",
        source: event && event.filename ? event.filename : "",
        line: event && typeof event.lineno === "number" ? event.lineno : 0,
        column: event && typeof event.colno === "number" ? event.colno : 0,
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event && Object.prototype.hasOwnProperty.call(event, "reason") ? event.reason : null;
      debugRuntimeIssue("unhandled-rejection", {
        message: reason && reason.message ? reason.message : String(reason || "Unknown rejection"),
      });
    });
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("load", scheduleInitialAutoFollow);
    window.addEventListener("pageshow", scheduleInitialAutoFollow);
    window.addEventListener("pageshow", handlePageResume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handlePageResume();
      }
    });
    window.addEventListener("scroll", handleViewportScroll, { passive: true });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.settingsDialogOpen) {
        closeSettingsDialog();
        return;
      }
      if (event.key === "Escape" && state.moderationDialog) {
        closeModerationDialog();
      }
    });
    ui.pauseBanner.addEventListener("click", scrollToLatest);
    if (ui.overlaySettingsButton) {
      ui.overlaySettingsButton.addEventListener("click", openSettingsDialog);
    }
    if (ui.overlaySettingsBackdrop) {
      ui.overlaySettingsBackdrop.addEventListener("click", (event) => {
        if (event.target === ui.overlaySettingsBackdrop) {
          closeSettingsDialog();
        }
      });
    }
    if (ui.overlaySettingsClose) {
      ui.overlaySettingsClose.addEventListener("click", closeSettingsDialog);
    }
    if (Array.isArray(ui.settingsTabs)) {
      for (const tab of ui.settingsTabs) {
        if (!tab) {
          continue;
        }
        tab.addEventListener("click", () => openSettingsTab(tab.dataset.settingsTab || "stream"));
      }
    }
    if (ui.settingsSave) {
      ui.settingsSave.addEventListener("click", saveSettingsDialog);
    }
    if (Array.isArray(ui.settingsTestActions)) {
      for (const button of ui.settingsTestActions) {
        if (!button) {
          continue;
        }
        button.addEventListener("click", () => {
          const keys = String(button.dataset.testKeys || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
          const label = String(button.dataset.testLabel || "Test alerts");
          triggerOverlayTestBatch(keys, label);
        });
      }
    }
    if (ui.settingsTrainStep) {
      ui.settingsTrainStep.addEventListener("click", triggerOverlayTrainStep);
    }
    if (ui.settingsTrainReset) {
      ui.settingsTrainReset.addEventListener("click", resetSupportTrainForTesting);
    }
    if (ui.settingsClearFeed) {
      ui.settingsClearFeed.addEventListener("click", clearRenderedFeed);
    }
    if (ui.dockComposer) {
      ui.dockComposer.addEventListener("submit", submitDockMessage);
    }
    if (ui.dockComposerInput) {
      ui.dockComposerInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitDockMessage(event);
        }
      });
    }
    if (ui.moderationModalBackdrop) {
      ui.moderationModalBackdrop.addEventListener("click", (event) => {
        if (event.target === ui.moderationModalBackdrop) {
          closeModerationDialog();
        }
      });
    }
    if (ui.moderationModalCancel) {
      ui.moderationModalCancel.addEventListener("click", closeModerationDialog);
    }
    if (ui.moderationModalClose) {
      ui.moderationModalClose.addEventListener("click", closeModerationDialog);
    }
    if (ui.moderationModalConfirm) {
      ui.moderationModalConfirm.addEventListener("click", confirmModerationDialog);
    }
    scheduleInitialAutoFollow();
    void restorePlatformRuntimeState().then(() => {
      renderStatus();
    });
    loadPersistedFeed();
    void ensureYouTubeSuperStickerMap();
    connectHistoryStream();
    connect();
    setInterval(renderStatus, 1000);
    setInterval(renderSupportTrainHud, 1000);
    setInterval(syncOverlaySettingsFromStorage, 1000);
    setInterval(() => {
      if (config.showModerationControls) {
        broadcastOverlaySettingsRuntime();
      }
      if (state.supportTrain && state.supportTrain.active) {
        broadcastSupportTrainRuntime();
      }
    }, 1000);
    setInterval(runHeartbeatCheck, config.heartbeatIntervalMs);
    setInterval(pollPersistedFeed, HISTORY_SYNC_INTERVAL_MS);
    setInterval(runLiveRecoveryCheck, 10000);
  }
})();
