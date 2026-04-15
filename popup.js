/**
 * Popup script — handles CEFR level selection and label appearance settings.
 * All preferences are persisted in chrome.storage.local and read by content.js.
 */

const DEFAULTS = {
  selectedLevel:    'A1',
  labelColor:       '#00ff00',
  labelFontSize:    13,
  labelFontFamily:  "'Netflix Sans', Arial, sans-serif",
  connectorColor:   '#90b8d0',
};

document.addEventListener('DOMContentLoaded', () => {
  // ── Element refs ──────────────────────────────────────────────────────────
  const levelSelector   = document.getElementById('level-selector');
  const levelBtns       = document.querySelectorAll('.level-btn');
  const currentLevelEl  = document.getElementById('current-level');

  const colorInput      = document.getElementById('label-color');
  const fontSizeSlider  = document.getElementById('font-size');
  const fontSizeVal     = document.getElementById('font-size-val');
  const fontFamilySel   = document.getElementById('font-family');
  const colorPresets    = document.querySelectorAll('.color-preset:not([data-target])');

  const connectorInput  = document.getElementById('connector-color');
  const connectorPresets = document.querySelectorAll('.color-preset[data-target="connector"]');

  const previewLabel    = document.getElementById('preview-label');
  const resetBtn        = document.getElementById('reset-btn');
  const reloadBtn       = document.getElementById('reload-btn');

  // ── Load persisted settings ───────────────────────────────────────────────
  chrome.storage.local.get(Object.keys(DEFAULTS), (stored) => {
    const s = { ...DEFAULTS, ...stored };

    // Level
    applyLevel(s.selectedLevel);

    // Appearance
    colorInput.value     = s.labelColor;
    fontSizeSlider.value = s.labelFontSize;
    fontSizeVal.textContent = `${s.labelFontSize}px`;
    fontFamilySel.value  = s.labelFontFamily;
    connectorInput.value = s.connectorColor;

    markActivePreset(colorPresets,    s.labelColor);
    markActivePreset(connectorPresets, s.connectorColor);
    updatePreview(s.labelColor, s.labelFontSize, s.labelFontFamily);
  });

  // ── Level selection ───────────────────────────────────────────────────────
  levelSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    const level = btn.dataset.level;
    applyLevel(level);
    chrome.storage.local.set({ selectedLevel: level });
  });

  function applyLevel(level) {
    levelBtns.forEach(b => b.classList.toggle('active', b.dataset.level === level));
    currentLevelEl.textContent = level;
  }

  // ── Label color ───────────────────────────────────────────────────────────
  colorInput.addEventListener('input', () => {
    const color = colorInput.value;
    markActivePreset(colorPresets, color);
    updatePreview(color, +fontSizeSlider.value, fontFamilySel.value);
    chrome.storage.local.set({ labelColor: color });
  });

  colorPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      colorInput.value = color;
      markActivePreset(colorPresets, color);
      updatePreview(color, +fontSizeSlider.value, fontFamilySel.value);
      chrome.storage.local.set({ labelColor: color });
    });
  });

  // ── Font size ─────────────────────────────────────────────────────────────
  fontSizeSlider.addEventListener('input', () => {
    const size = +fontSizeSlider.value;
    fontSizeVal.textContent = `${size}px`;
    updatePreview(colorInput.value, size, fontFamilySel.value);
    chrome.storage.local.set({ labelFontSize: size });
  });

  // ── Font family ───────────────────────────────────────────────────────────
  fontFamilySel.addEventListener('change', () => {
    const family = fontFamilySel.value;
    updatePreview(colorInput.value, +fontSizeSlider.value, family);
    chrome.storage.local.set({ labelFontFamily: family });
  });

  // ── Connector color ───────────────────────────────────────────────────────
  connectorInput.addEventListener('input', () => {
    const color = connectorInput.value;
    markActivePreset(connectorPresets, color);
    chrome.storage.local.set({ connectorColor: color });
  });

  connectorPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      connectorInput.value = color;
      markActivePreset(connectorPresets, color);
      chrome.storage.local.set({ connectorColor: color });
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ ...DEFAULTS }, () => {
      applyLevel(DEFAULTS.selectedLevel);
      colorInput.value      = DEFAULTS.labelColor;
      fontSizeSlider.value  = DEFAULTS.labelFontSize;
      fontSizeVal.textContent = `${DEFAULTS.labelFontSize}px`;
      fontFamilySel.value   = DEFAULTS.labelFontFamily;
      connectorInput.value  = DEFAULTS.connectorColor;
      markActivePreset(colorPresets,    DEFAULTS.labelColor);
      markActivePreset(connectorPresets, DEFAULTS.connectorColor);
      updatePreview(DEFAULTS.labelColor, DEFAULTS.labelFontSize, DEFAULTS.labelFontFamily);
    });
  });

  // ── Reload Page ──────────────────────────────────────────────────────────
  reloadBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function updatePreview(color, size, family) {
    previewLabel.style.color      = color;
    previewLabel.style.fontSize   = `${size}px`;
    previewLabel.style.fontFamily = family;
  }

  function markActivePreset(presets, activeColor) {
    presets.forEach(p => {
      p.classList.toggle('active', p.dataset.color === activeColor);
    });
  }
});
