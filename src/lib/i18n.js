export const UI_LOCALES = {
  EN: "en",
  ZH: "zh",
};

const STORAGE_KEY = "hk-bus-typing-locale";

export const STRINGS = {
  en: {
    appName: "HK BUS TYPING",
    tagline: "Type your way along real Hong Kong bus routes and stop names.",
    chooseRoute: "Choose a route",
    backToRoutes: "Back to routes",
    direction: "Direction",
    mode: "Mode",
    modeTimed: "30s sprint",
    modeLine: "Full route",
    typingLanguage: "Typing",
    typingEn: "English",
    typingZh: "中文",
    start: "Start",
    startHint: "Press Enter to start · Esc to go back",
    homeHint: "Keyboard: Tab or 1–9 / 0 pick a route · S search",
    lineHint: "Enter start · Esc back · D direction · M mode · T typing",
    resultHint: "Enter play again · Esc choose route",
    stops: "stops",
    stop: "Next stop",
    completedStops: "Stops",
    timeLeft: "Time left",
    elapsed: "Elapsed",
    accuracy: "Accuracy",
    resultTitle: "Terminus reached",
    resultTitleProgress: "Nice driving — passengers delivered!",
    resultTitleZero: "Hey driver… got your licence yet?",
    retry: "Play again",
    backHome: "Choose another route",
    typingInstruction: "Type the stop name shown.",
    tapToType: "Tap here to type",
    collapsePanel: "Collapse panel",
    expandPanel: "Expand panel",
    soundOn: "Turn sound on",
    soundOff: "Turn sound off",
    loading: "Loading bus routes…",
    loadError: "Failed to load map data",
    reload: "Reload",
    darkMode: "Toggle dark mode",
    uiLanguage: "切換中文介面",
    search: "Search all routes",
    searchPlaceholder: "Route number or destination…",
    searchLoading: "Loading route database…",
    searchNoResults: "No matching routes",
    searchError: "Couldn't load routes — check your connection",
    searchRetry: "Retry",
    featuredRoutes: "Featured routes",
    operatorKmb: "KMB",
    operatorCtb: "Citybus",
    operatorNlb: "NLB",
    dataCredit: "Data",
    stopsCredit: "HK Bus Crawling @2021",
    waypointsCredit: "Route geometry: route-waypoints",
    mapCredit: "© OpenStreetMap contributors",
    createdByBefore: "Created by ",
    createdByAfter: "",
    disclaimer:
      "Not affiliated with KMB, Citybus or NLB. For typing practice only.",
  },
  zh: {
    appName: "香港巴士打字",
    tagline: "沿真實香港巴士路線逐站輸入站名的打字遊戲。",
    chooseRoute: "選擇路線",
    backToRoutes: "返回選線",
    direction: "行車方向",
    mode: "模式",
    modeTimed: "30 秒快打",
    modeLine: "全線挑戰",
    typingLanguage: "輸入語言",
    typingEn: "English",
    typingZh: "中文",
    start: "開始",
    startHint: "按 Enter 開始 · Esc 返回",
    homeHint: "鍵盤：Tab 或 1–9 / 0 選線 · S 搜尋",
    lineHint: "Enter 開始 · Esc 返回 · D 方向 · M 模式 · T 輸入語言",
    resultHint: "Enter 再玩一次 · Esc 重新選線",
    stops: "個車站",
    stop: "下一站",
    completedStops: "完成站數",
    timeLeft: "剩餘時間",
    elapsed: "時間",
    accuracy: "正確率",
    resultTitle: "已到達總站",
    resultTitleProgress: "揸得唔錯喎，乘客都坐得舒服！",
    resultTitleZero: "師兄，你考咗車牌未？",
    retry: "再玩一次",
    backHome: "重新選線",
    typingInstruction: "輸入畫面顯示的站名。",
    tapToType: "點此輸入",
    collapsePanel: "收起面板",
    expandPanel: "展開面板",
    soundOn: "開啟音效",
    soundOff: "關閉音效",
    loading: "正在載入巴士路線…",
    loadError: "地圖資料載入失敗",
    reload: "重新載入",
    darkMode: "切換深色模式",
    uiLanguage: "Switch to English",
    search: "搜尋所有路線",
    searchPlaceholder: "路線號碼或目的地…",
    searchLoading: "正在載入路線資料庫…",
    searchNoResults: "找不到相符路線",
    searchError: "路線載入失敗，請檢查網絡",
    searchRetry: "重試",
    featuredRoutes: "精選路線",
    operatorKmb: "九巴",
    operatorCtb: "城巴",
    operatorNlb: "嶼巴",
    dataCredit: "資料",
    stopsCredit: "HK Bus Crawling @2021",
    waypointsCredit: "路線軌跡：route-waypoints",
    mapCredit: "© OpenStreetMap 貢獻者",
    createdByBefore: "由 ",
    createdByAfter: " 製作",
    disclaimer: "本網站與九巴、城巴及嶼巴無關，僅供打字練習使用。",
  },
};

export function getInitialLocale(storage, languages) {
  const saved = storage?.getItem(STORAGE_KEY);
  if (saved && Object.hasOwn(STRINGS, saved)) return saved;
  const preferred = languages?.[0] ?? "";
  return preferred.toLowerCase().startsWith("zh") ? UI_LOCALES.ZH : UI_LOCALES.EN;
}

export function persistLocale(storage, locale) {
  try {
    storage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Private browsing may block storage; the toggle still works in-session.
  }
}

export function translate(locale, key) {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}
