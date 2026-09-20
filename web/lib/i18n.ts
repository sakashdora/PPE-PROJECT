export type SupportedLocale = "en" | "hi" | "or";

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  liveWall: string;
  alertQueue: string;
  history: string;
  reports: string;
  cameras: string;
  zones: string;
  thresholds: string;
  health: string;
  criticalAlertActive: string;
  viewStream: string;
  acknowledge: string;
  resolve: string;
  falseAlarm: string;
  systemLive: string;
  systemConnecting: string;
  systemReconnecting: string;
  systemOffline: string;
  disconnectedSince: string;
  audioSirenDisabled: string;
  clickToEnableAudio: string;
  audioActive: string;
  demoScenario: string;
  triggerEvent: string;
  allSeverities: string;
  openAlerts: string;
  resolvedAlerts: string;
  item_helmet: string;
  item_vest: string;
  item_gloves: string;
  item_boots: string;
  item_fire: string;
  item_smoke: string;
  item_smoking: string;
  missing_prefix: string;
  sector: string;
  camera: string;
  confidence: string;
  votes: string;
  timeAgo: string;
  justNow: string;
  minAgo: string;
  notes: string;
  saveNote: string;
  exportCsv: string;
  complianceRate: string;
  fps: string;
  latency: string;
  activeModel: string;
}

export const DICTIONARY: Record<SupportedLocale, Translations> = {
  en: {
    appTitle: "Factory Safety AI",
    appSubtitle: "Real-Time Edge Computer Vision & Hazard Mitigation",
    liveWall: "Live Wall",
    alertQueue: "Alert Queue",
    history: "Audit History",
    reports: "Safety Analytics",
    cameras: "Cameras",
    zones: "Zones",
    thresholds: "Thresholds",
    health: "Node Health",
    criticalAlertActive: "CRITICAL HAZARD DETECTED",
    viewStream: "View Stream",
    acknowledge: "Acknowledge",
    resolve: "Resolve",
    falseAlarm: "False Alarm",
    systemLive: "EDGE SYSTEM LIVE",
    systemConnecting: "CONNECTING TO EDGE...",
    systemReconnecting: "DISCONNECTED — ATTEMPTING RECONNECT",
    systemOffline: "SYSTEM OFFLINE (USING LOCAL CACHE)",
    disconnectedSince: "Disconnected since",
    audioSirenDisabled: "Audio Siren Muted (Click to Unlock)",
    clickToEnableAudio: "Enable Alarm Audio",
    audioActive: "Audio Siren Active",
    demoScenario: "Jury Demo Scenarios",
    triggerEvent: "Trigger Event",
    allSeverities: "All Alerts",
    openAlerts: "Active Queue",
    resolvedAlerts: "Resolved",
    item_helmet: "Safety Helmet",
    item_vest: "High-Visibility Vest",
    item_gloves: "Safety Gloves",
    item_boots: "Steel-Toe Boots",
    item_fire: "Fire Outbreak",
    item_smoke: "Dense Smoke",
    item_smoking: "Restricted Smoking",
    missing_prefix: "Missing",
    sector: "Sector",
    camera: "Camera",
    confidence: "Confidence",
    votes: "Temporal Votes",
    timeAgo: "ago",
    justNow: "just now",
    minAgo: "m ago",
    notes: "Supervisor Action Notes",
    saveNote: "Log Note",
    exportCsv: "Export CSV",
    complianceRate: "PPE Compliance Rate",
    fps: "FPS",
    latency: "Latency",
    activeModel: "Active Model",
  },
  hi: {
    appTitle: "फैक्ट्री सुरक्षा एआई",
    appSubtitle: "रीयल-टाइम एज कंप्यूटर विज़न एवं खतरा निवारण",
    liveWall: "लाइव वॉल",
    alertQueue: "अलर्ट सूची",
    history: "ऑडिट इतिहास",
    reports: "सुरक्षा रिपोर्ट",
    cameras: "कैमरे",
    zones: "सुरक्षा क्षेत्र",
    thresholds: "सीमाएं",
    health: "सिस्टम स्वास्थ्य",
    criticalAlertActive: "गंभीर खतरा पाया गया!",
    viewStream: "स्ट्रीम देखें",
    acknowledge: "स्वीकार करें",
    resolve: "समाधान करें",
    falseAlarm: "गलत चेतावनी",
    systemLive: "एज सिस्टम सक्रिय",
    systemConnecting: "एज से कनेक्ट हो रहा है...",
    systemReconnecting: "संपर्क टूटा — पुनः प्रयास जारी",
    systemOffline: "सिस्टम ऑफ़लाइन (लोकल कैश सक्रिय)",
    disconnectedSince: "संपर्क विच्छेद समय:",
    audioSirenDisabled: "अलार्म म्यूट है (सक्रिय करने के लिए क्लिक करें)",
    clickToEnableAudio: "अलार्म ऑडियो चालू करें",
    audioActive: "अलार्म ऑडियो सक्रिय",
    demoScenario: "जूरी डेमो परिदृश्य",
    triggerEvent: "इवेंट चलाएं",
    allSeverities: "सभी अलर्ट",
    openAlerts: "सक्रिय अलर्ट",
    resolvedAlerts: "समाधान किए गए",
    item_helmet: "सुरक्षा हेलमेट",
    item_vest: "सुरक्षा बनियान",
    item_gloves: "दस्ताने",
    item_boots: "सुरक्षा जूते",
    item_fire: "आग का खतरा",
    item_smoke: "धुआं",
    item_smoking: "प्रतिबंधित धूम्रपान",
    missing_prefix: "अनुपस्थित",
    sector: "सेक्टर",
    camera: "कैमरा",
    confidence: "सटीकता",
    votes: "टेंपोरल वोट्स",
    timeAgo: "पहले",
    justNow: "अभी",
    minAgo: "मिनट पहले",
    notes: "सुपरवाइज़र कार्रवाई नोट",
    saveNote: "नोट सहेजें",
    exportCsv: "सीएसवी निर्यात",
    complianceRate: "पीपीई अनुपालन दर",
    fps: "एफपीएस",
    latency: "विलंबता",
    activeModel: "सक्रिय मॉडल",
  },
  or: {
    appTitle: "କାରଖାନା ସୁରକ୍ଷା AI",
    appSubtitle: "ରିଅଲ-ଟାଇମ ଏଜ୍ କମ୍ପ୍ୟୁଟର ଭିଜନ ଓ ବିପଦ ପ୍ରଶମନ",
    liveWall: "ଲାଇଭ୍ ୱାଲ୍",
    alertQueue: "ଆଲର୍ଟ ତାଲିକା",
    history: "ଅଡିଟ୍ ଇତିହାସ",
    reports: "ସୁରକ୍ଷା ରିପୋର୍ଟ",
    cameras: "କ୍ୟାମେରା",
    zones: "ଜୋନ୍ ସମୂହ",
    thresholds: "ଥ୍ରେସହୋଲ୍ଡ",
    health: "ସିଷ୍ଟମ ସ୍ୱାସ୍ଥ୍ୟ",
    criticalAlertActive: "ଗୁରୁତର ବିପଦ ଚିହ୍ନଟ ହୋଇଛି!",
    viewStream: "ଷ୍ଟ୍ରିମ୍ ଦେଖନ୍ତୁ",
    acknowledge: "ସ୍ୱୀକାର କରନ୍ତୁ",
    resolve: "ସମାଧାନ କରନ୍ତୁ",
    falseAlarm: "ଭୁଲ୍ ଚେତାବନୀ",
    systemLive: "ଏଜ୍ ସିଷ୍ଟମ ସକ୍ରିୟ",
    systemConnecting: "ସଂଯୋଗ ହେଉଛି...",
    systemReconnecting: "ସଂଯୋଗ ବିଚ୍ଛିନ୍ନ — ପୁନଃ ସଂଯୋଗ ଚାଲିଛି",
    systemOffline: "ସିଷ୍ଟମ ଅଫଲାଇନ୍ (ଲୋକାଲ କ୍ୟାଶ୍)",
    disconnectedSince: "ବିଚ୍ଛିନ୍ନ ହେବାର ସମୟ:",
    audioSirenDisabled: "ସାଇରନ ବନ୍ଦ ଅଛି (ଖୋଲିବାକୁ କ୍ଲିକ୍ କରନ୍ତୁ)",
    clickToEnableAudio: "ଅଲାର୍ମ ଶବ୍ଦ ଚାଲୁ କରନ୍ତୁ",
    audioActive: "ଅଲାର୍ମ ଶବ୍ଦ ସକ୍ରିୟ",
    demoScenario: "ଡେମୋ ସିନାରିଓ",
    triggerEvent: "ଇଭେଣ୍ଟ ଚଲାନ୍ତୁ",
    allSeverities: "ସମସ୍ତ ଆଲର୍ଟ",
    openAlerts: "ସକ୍ରିୟ ଆଲର୍ଟ",
    resolvedAlerts: "ସମାହିତ",
    item_helmet: "ସୁରକ୍ଷା ହେଲମେଟ",
    item_vest: "ସୁରକ୍ଷା ଜ୍ୟାକେଟ",
    item_gloves: "ଗ୍ଲୋଭ୍ସ",
    item_boots: "ସୁରକ୍ଷା ବୁଟ",
    item_fire: "ନିଆଁ ବିପଦ",
    item_smoke: "ଧୂଆଁ",
    item_smoking: "ଧୂମପାନ ନିଷିଦ୍ଧ",
    missing_prefix: "ଅନୁପସ୍ଥିତ",
    sector: "ସେକ୍ଟର",
    camera: "କ୍ୟାମେରା",
    confidence: "ବିଶ୍ୱାସନୀୟତା",
    votes: "ଟେମ୍ପୋରାଲ ଭୋଟ",
    timeAgo: "ପୂର୍ବରୁ",
    justNow: "ବର୍ତ୍ତମାନ",
    minAgo: "ମିନିଟ୍ ପୂର୍ବରୁ",
    notes: "ତଦାରଖକାରୀ ମନ୍ତବ୍ୟ",
    saveNote: "ମନ୍ତବ୍ୟ ସାଇତନ୍ତୁ",
    exportCsv: "CSV ଏକ୍ସପୋର୍ଟ",
    complianceRate: "PPE ଅନୁପାଳନ ହାର",
    fps: "FPS",
    latency: "ବିଳମ୍ବ",
    activeModel: "ସକ୍ରିୟ ମଡେଲ",
  },
};
