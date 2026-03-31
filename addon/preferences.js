(function () {
  const BASE_URL_PREF_KEY = "extensions.zotero.sideai.baseURL";
  const MODEL_PREF_KEY = "extensions.zotero.sideai.model";
  const API_KEY_PREF_KEY = "extensions.zotero.sideai.apiKey";
  const DEFAULT_BASE_URL = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-4.1-mini";

  function getBaseUrlInput() {
    return document.getElementById("sideai-pref-baseurl");
  }

  function getModelInput() {
    return document.getElementById("sideai-pref-model");
  }

  function getApiKeyInput() {
    return document.getElementById("sideai-pref-apikey");
  }

  function getStatus() {
    return document.getElementById("sideai-pref-status");
  }

  function setStatus(message, isError) {
    const status = getStatus();
    if (!status) {
      return;
    }
    status.textContent = message;
    status.style.color = isError ? "#b3261e" : "#666";
  }

  function loadValue() {
    const baseUrlInput = getBaseUrlInput();
    const modelInput = getModelInput();
    const apiKeyInput = getApiKeyInput();

    if (!baseUrlInput || !modelInput || !apiKeyInput) {
      return;
    }
    const savedBaseUrl = Zotero.Prefs.get(BASE_URL_PREF_KEY, true);
    const savedModel = Zotero.Prefs.get(MODEL_PREF_KEY, true);
    const savedApiKey = Zotero.Prefs.get(API_KEY_PREF_KEY, true);
    baseUrlInput.value =
      typeof savedBaseUrl === "string" && savedBaseUrl.trim()
        ? savedBaseUrl.trim()
        : DEFAULT_BASE_URL;
    modelInput.value =
      typeof savedModel === "string" && savedModel.trim()
        ? savedModel.trim()
        : DEFAULT_MODEL;
    apiKeyInput.value = typeof savedApiKey === "string" ? savedApiKey : "";
  }

  function saveValue() {
    const baseUrlInput = getBaseUrlInput();
    const modelInput = getModelInput();
    const apiKeyInput = getApiKeyInput();
    if (!baseUrlInput || !modelInput || !apiKeyInput) {
      return;
    }
    const baseUrl = baseUrlInput.value.trim();
    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl) {
      setStatus("Base URL 不能为空。", true);
      return;
    }
    if (!model) {
      setStatus("模型不能为空。", true);
      return;
    }
    if (!apiKey) {
      setStatus("API Key 不能为空。", true);
      return;
    }

    Zotero.Prefs.set(BASE_URL_PREF_KEY, baseUrl, true);
    Zotero.Prefs.set(MODEL_PREF_KEY, model, true);
    Zotero.Prefs.set(API_KEY_PREF_KEY, apiKey, true);
    setStatus("连接设置已保存。", false);
  }

  function resetValue() {
    const baseUrlInput = getBaseUrlInput();
    const modelInput = getModelInput();
    const apiKeyInput = getApiKeyInput();
    if (!baseUrlInput || !modelInput || !apiKeyInput) {
      return;
    }
    baseUrlInput.value = DEFAULT_BASE_URL;
    modelInput.value = DEFAULT_MODEL;
    apiKeyInput.value = "";
    Zotero.Prefs.set(BASE_URL_PREF_KEY, DEFAULT_BASE_URL, true);
    Zotero.Prefs.set(MODEL_PREF_KEY, DEFAULT_MODEL, true);
    Zotero.Prefs.set(API_KEY_PREF_KEY, "", true);
    setStatus("已恢复默认连接设置。", false);
  }

  window.addEventListener("load", () => {
    loadValue();
    document.getElementById("sideai-pref-save")?.addEventListener("click", saveValue);
    document.getElementById("sideai-pref-reset")?.addEventListener("click", resetValue);
  });
})();
