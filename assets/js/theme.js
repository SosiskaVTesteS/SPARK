/* ═══════════════════════════════════════════════════════
   SPARK — theme.js   ThemeEngine v1
   Preset themes + custom color pickers
   Applied BEFORE first paint via early <script> in <head>
   ═══════════════════════════════════════════════════════ */
'use strict';

var ThemeEngine = (function () {

  var STORAGE_KEY = 'spark_theme_v1';

  /* ─── Helper ─── */
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) : '123,92,250';
  }

  /* ─── 16 Preset themes (8 Solid + 8 Multi-color V3) ─── */
  var PRESETS = {
    cosmos: {
      id: 'cosmos', name: 'Cosmos', icon: '🌌',
      vl: '#7B5CFA', vl2: '#9B7CFF', vlDk: '#5A3FD0',
      ac: '#E8C55A', ac2: '#5AE8C5',
      graph: '#E8C55A', mu2: '#6E7099'
    },
    ocean: {
      id: 'ocean', name: 'Ocean', icon: '🌊',
      vl: '#3B82F6', vl2: '#60A5FA', vlDk: '#1D4ED8',
      ac: '#38BDF8', ac2: '#22D3EE',
      graph: '#38BDF8', mu2: '#5B7FA6'
    },
    ember: {
      id: 'ember', name: 'Ember', icon: '🔥',
      vl: '#F97316', vl2: '#FB923C', vlDk: '#C2410C',
      ac: '#FBBF24', ac2: '#FB923C',
      graph: '#FBBF24', mu2: '#8C6E4B'
    },
    forest: {
      id: 'forest', name: 'Forest', icon: '🌿',
      vl: '#22C55E', vl2: '#4ADE80', vlDk: '#15803D',
      ac: '#86EFAC', ac2: '#34D399',
      graph: '#86EFAC', mu2: '#4B7A5C'
    },
    rose: {
      id: 'rose', name: 'Rose', icon: '🌸',
      vl: '#F43F5E', vl2: '#FB7185', vlDk: '#BE123C',
      ac: '#FDA4AF', ac2: '#FB7185',
      graph: '#FDA4AF', mu2: '#8C4B5C'
    },
    arctic: {
      id: 'arctic', name: 'Arctic', icon: '❄️',
      vl: '#06B6D4', vl2: '#22D3EE', vlDk: '#0E7490',
      ac: '#A5F3FC', ac2: '#67E8F9',
      graph: '#A5F3FC', mu2: '#4B7A8C'
    },
    void: {
      id: 'void', name: 'Void', icon: '🔮',
      vl: '#8B5CF6', vl2: '#A78BFA', vlDk: '#6D28D9',
      ac: '#C4B5FD', ac2: '#A78BFA',
      graph: '#C4B5FD', mu2: '#7060A0'
    },
    gold: {
      id: 'gold', name: 'Gold', icon: '✨',
      vl: '#D97706', vl2: '#F59E0B', vlDk: '#92400E',
      ac: '#FCD34D', ac2: '#FDE68A',
      graph: '#FCD34D', mu2: '#8C7040'
    },
    aurora: {
      id: 'aurora', name: 'Aurora', icon: '🌌',
      vl: '#00F260', vl2: '#0575E6', vlDk: '#0575E6',
      ac: '#5AE8C5', ac2: '#00F260',
      graph: '#00F260', mu2: '#5B7FA6'
    },
    cyberpunk: {
      id: 'cyberpunk', name: 'Cyberpunk', icon: '⚡',
      vl: '#8B5CF6', vl2: '#EC4899', vlDk: '#EC4899',
      ac: '#FCD34D', ac2: '#F43F5E',
      graph: '#EC4899', mu2: '#7060A0'
    },
    sunset: {
      id: 'sunset', name: 'Sunset', icon: '🌇',
      vl: '#FF5E62', vl2: '#FF9966', vlDk: '#FF9966',
      ac: '#E8C55A', ac2: '#FF5E62',
      graph: '#FF5E62', mu2: '#8C6E4B'
    },
    nebula: {
      id: 'nebula', name: 'Nebula', icon: '💫',
      vl: '#4F46E5', vl2: '#10B981', vlDk: '#10B981',
      ac: '#E5E7EB', ac2: '#34D399',
      graph: '#10B981', mu2: '#4B7A5C'
    },
    neon: {
      id: 'neon', name: 'Neon', icon: '💡',
      vl: '#EC4899', vl2: '#2DD4BF', vlDk: '#2DD4BF',
      ac: '#FBBF24', ac2: '#2DD4BF',
      graph: '#EC4899', mu2: '#8C4B5C'
    },
    flare: {
      id: 'flare', name: 'Flare', icon: '☀️',
      vl: '#F59E0B', vl2: '#EF4444', vlDk: '#EF4444',
      ac: '#FFFFFF', ac2: '#EF4444',
      graph: '#F59E0B', mu2: '#8C7040'
    },
    magic: {
      id: 'magic', name: 'Magic', icon: '🧪',
      vl: '#2563EB', vl2: '#D946EF', vlDk: '#D946EF',
      ac: '#5AE8C5', ac2: '#D946EF',
      graph: '#D946EF', mu2: '#5B7FA6'
    },
    prism: {
      id: 'prism', name: 'Prism', icon: '💎',
      vl: '#F43F5E', vl2: '#3B82F6', vlDk: '#10B981',
      ac: '#FBBF24', ac2: '#8B5CF6',
      graph: '#3B82F6', mu2: '#7060A0'
    }
  };

  var _active = null;

  /* ─── Apply theme to :root CSS variables ─── */
  function apply(t) {
    var r = document.documentElement;
    var vlRgb  = hexToRgb(t.vl  || '#7B5CFA');
    var acRgb  = hexToRgb(t.ac  || '#E8C55A');
    var ac2Rgb = hexToRgb(t.ac2 || '#5AE8C5');

    r.style.setProperty('--vl',       t.vl  || '#7B5CFA');
    r.style.setProperty('--vl2',      t.vl2 || '#9B7CFF');
    r.style.setProperty('--vl-dk',    t.vlDk|| '#5A3FD0');
    r.style.setProperty('--vl-rgb',   vlRgb);
    r.style.setProperty('--vl-glow',  'rgba(' + vlRgb  + ',0.45)');
    r.style.setProperty('--sh-btn-vl','0 4px 20px rgba(' + vlRgb  + ',0.45)');
    r.style.setProperty('--sh-glow-v','0 0 30px rgba(' + vlRgb  + ',0.32), 0 0 64px rgba(' + vlRgb  + ',0.12)');

    r.style.setProperty('--ac',       t.ac  || '#E8C55A');
    r.style.setProperty('--ac-rgb',   acRgb);
    r.style.setProperty('--ac-glow',  'rgba(' + acRgb  + ',0.42)');

    r.style.setProperty('--ac2',      t.ac2 || '#5AE8C5');
    r.style.setProperty('--ac2-rgb',  ac2Rgb);

    r.style.setProperty('--graph-line', t.graph || t.ac || '#E8C55A');
    r.style.setProperty('--mu2',      t.mu2 || '#6E7099');

    /* Swap g-vl gradient */
    r.style.setProperty('--g-vl', 'linear-gradient(135deg,' + (t.vl||'#7B5CFA') + ',' + (t.vlDk||'#5A3FD0') + ')');

    /* Card border tint override for theming */
    r.style.setProperty('--card-bd-tint', 'rgba(' + vlRgb + ',0.32)');

    _active = t;
    window._sparkActiveTheme = t;

    /* Sync any open color pickers in Theme Studio */
    syncPickerUI(t);
  }

  /* ─── Sync <input type=color> values if Theme Studio is open ─── */
  function syncPickerUI(t) {
    var map = { vl: t.vl, ac: t.ac, ac2: t.ac2, graph: t.graph, mu2: t.mu2 };
    Object.keys(map).forEach(function (k) {
      var el = document.getElementById('tsPicker-' + k);
      if (el && map[k]) el.value = map[k];
    });
  }

  function save(t) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { var t = JSON.parse(raw); apply(t); return t; }
    } catch (e) {}
    apply(PRESETS.cosmos);
    return PRESETS.cosmos;
  }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    apply(PRESETS.cosmos);
    return PRESETS.cosmos;
  }

  function applyPreset(id) {
    var t = PRESETS[id];
    if (!t) return;
    apply(t);
    save(t);
    return t;
  }

  function applyCustom(overrides) {
    var base = _active || PRESETS.cosmos;
    var merged = Object.assign({}, base, overrides);
    apply(merged);
    save(merged);
    return merged;
  }

  function getActive() { return _active || PRESETS.cosmos; }

  function getGraphColor() {
    return (_active && _active.graph) || '#E8C55A';
  }

  return {
    PRESETS: PRESETS,
    apply: apply,
    save: save,
    load: load,
    reset: reset,
    applyPreset: applyPreset,
    applyCustom: applyCustom,
    getActive: getActive,
    getGraphColor: getGraphColor
  };
})();

window.ThemeEngine = ThemeEngine;

/* Apply immediately (this script runs in <head>) */
ThemeEngine.load();
