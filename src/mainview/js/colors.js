// More color references
// https://github.com/d3/d3-scale-chromatic
// http://bl.ocks.org/emmasaunders/52fa83767df27f1fc8b3ee2c6d372c74
// Seaborn palettes: https://seaborn.pydata.org/tutorial/color_palettes.html

const size_scales = [0, 1e3, 1e5, 1e6, 1e8, 1e9, 1e12, 1e14, 1e15];
// 1K 1e3
// 1MB 1e6
// 1GB 1e9
// 1TB 1e12
// 1PB 1e15

var accent = d3.scaleOrdinal(d3.schemeAccent);
// try multi-hue
const color_range = d3.scale
  .linear()
  .range(["#000004", "#fcffa4"])
  .interpolate(d3.interpolateLab);

// TODO fix lab deopt.
// https://github.com/colorjs/color-space
// chroma

const hue = d3.scale.category10(); // legacy palette (used for some schemes)

const size_color_range = color_range
  .ticks(size_scales.length - 1)
  .map((v) => color_range(v));
const linear = d3.scale.linear();

const size_scale_colors = d3.scale
  .linear()
  .domain(size_scales)
  .clamp(true)
  .range(["#000004", "#fcffa4"]);

const depth_luminance = d3.scale
  .linear() // .sqrt()
  .domain([0, 11])
  .clamp(true)
  .range([75, 96]);

const greyScale = d3.scale
  .linear()
  .range(["black", "white"])
  .domain([0, 12])
  .clamp(true);

// =============================================================================
// SEABORN COLOR PALETTES
// These are the official seaborn color palettes, converted to hex
// =============================================================================

// Seaborn "deep" palette - bold, distinct colors (default)
const SEABORN_DEEP = [
  "#4C72B0", // blue
  "#DD8452", // orange
  "#55A868", // green
  "#C44E52", // red
  "#8172B3", // purple
  "#937860", // brown
  "#DA8BC3", // pink
  "#8C8C8C", // gray
  "#CCB974", // olive/yellow
  "#64B5CD", // cyan
];

// Seaborn "muted" palette - softer, easier on the eyes
const SEABORN_MUTED = [
  "#4878D0", // blue
  "#EE854A", // orange
  "#6ACC64", // green
  "#D65F5F", // red
  "#956CB4", // purple
  "#8C613C", // brown
  "#DC7EC0", // pink
  "#797979", // gray
  "#D5BB67", // olive/yellow
  "#82C6E2", // cyan
];

// Seaborn "pastel" palette - light and soft
const SEABORN_PASTEL = [
  "#A1C9F4", // blue
  "#FFB482", // orange
  "#8DE5A1", // green
  "#FF9F9B", // red
  "#D0BBFF", // purple
  "#DEBB9B", // brown
  "#FAB0E4", // pink
  "#CFCFCF", // gray
  "#FFFEA3", // yellow
  "#B9F2F0", // cyan
];

// Seaborn "bright" palette - high saturation, vivid
const SEABORN_BRIGHT = [
  "#023EFF", // blue
  "#FF7C00", // orange
  "#1AC938", // green
  "#E8000B", // red
  "#8B2BE2", // purple
  "#9F4800", // brown
  "#F14CC1", // pink
  "#A3A3A3", // gray
  "#FFC400", // yellow
  "#00D7FF", // cyan
];

// Seaborn "dark" palette - rich, darker tones
const SEABORN_DARK = [
  "#001C7F", // blue
  "#B1400D", // orange
  "#12711C", // green
  "#8C0800", // red
  "#591E71", // purple
  "#592F0D", // brown
  "#A23582", // pink
  "#3C3C3C", // gray
  "#B8850A", // olive/yellow
  "#006374", // cyan
];

// Seaborn "colorblind" palette - optimized for color vision deficiency
const SEABORN_COLORBLIND = [
  "#0173B2", // blue
  "#DE8F05", // orange
  "#029E73", // green
  "#D55E00", // vermillion
  "#CC78BC", // pink
  "#CA9161", // brown
  "#FBAFE4", // light pink
  "#949494", // gray
  "#ECE133", // yellow
  "#56B4E9", // sky blue
];

// Map file categories to seaborn palette indices
const CATEGORY_TO_INDEX_11 = {
  code: 0, // blue
  video: 1, // orange
  audio: 2, // green (related to media)
  archive: 3, // red
  image: 4, // purple
  font: 5, // brown
  slide: 6, // pink
  sheet: 7, // gray
  text: 8, // yellow/olive
  web: 9, // cyan
};

const CATEGORY_TO_INDEX_6 = {
  code: 0, // blue
  media: 1, // orange
  image: 4, // purple
  archive: 3, // red
  doc: 2, // green
  obj: 7, // gray
};

// Cache for seaborn color lookups
const seabornCache = {};

// Current seaborn palette (can be switched)
let currentSeabornPalette = SEABORN_DEEP;
let currentPaletteName = "deep";

function setSeabornPalette(name) {
  const palettes = {
    deep: SEABORN_DEEP,
    muted: SEABORN_MUTED,
    pastel: SEABORN_PASTEL,
    bright: SEABORN_BRIGHT,
    dark: SEABORN_DARK,
    colorblind: SEABORN_COLORBLIND,
  };

  if (palettes[name]) {
    currentSeabornPalette = palettes[name];
    currentPaletteName = name;
    // Clear cache when palette changes
    Object.keys(seabornCache).forEach((key) => delete seabornCache[key]);
  }
}

// Seaborn scheme for 11 categories
function schemeSeaborn11(ext) {
  const cacheKey = `${currentPaletteName}_11_${ext}`;
  if (seabornCache[cacheKey]) {
    return seabornCache[cacheKey];
  }

  if (ext in extension_categories_11) {
    const category = extension_categories_11[ext];
    const index = CATEGORY_TO_INDEX_11[category];
    if (index !== undefined) {
      const hex = currentSeabornPalette[index % currentSeabornPalette.length];
      const lab = d3.lab(hex);
      seabornCache[cacheKey] = lab;
      return lab;
    }
  }

  // Fall back to hash-based coloring using current palette
  return schemeSeabornHash(ext);
}

// Seaborn scheme for 6 categories
function schemeSeaborn6(ext) {
  const cacheKey = `${currentPaletteName}_6_${ext}`;
  if (seabornCache[cacheKey]) {
    return seabornCache[cacheKey];
  }

  if (ext in extension_categories_6) {
    const category = extension_categories_6[ext];
    const index = CATEGORY_TO_INDEX_6[category];
    if (index !== undefined) {
      const hex = currentSeabornPalette[index % currentSeabornPalette.length];
      const lab = d3.lab(hex);
      seabornCache[cacheKey] = lab;
      return lab;
    }
  }

  // Fall back to hash-based coloring using current palette
  return schemeSeabornHash(ext);
}

// Hash-based coloring using seaborn palette for unknown extensions
function schemeSeabornHash(ext) {
  const cacheKey = `${currentPaletteName}_hash_${ext}`;
  if (seabornCache[cacheKey]) {
    return seabornCache[cacheKey];
  }

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const index = hashString(ext) % currentSeabornPalette.length;
  const hex = currentSeabornPalette[index];
  const lab = d3.lab(hex);
  seabornCache[cacheKey] = lab;
  return lab;
}

// =============================================================================
// DARK MODE SUPPORT
// =============================================================================

let isDarkMode = localStorage.dark_mode === "true";

function toggleDarkMode(enabled) {
  isDarkMode = enabled;
  localStorage.dark_mode = enabled ? "true" : "false";

  if (enabled) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  // Refresh visualization if data is loaded
  if (PluginManager.data) {
    State.showWorking((done) => {
      PluginManager.cleanup();
      PluginManager.loadLast();
      done();
    });
  }
}

// Initialize dark mode on load
if (isDarkMode) {
  document.body.classList.add("dark-mode");
}

// =============================================================================
// COLOR SCHEMES
// =============================================================================

const COLOR_SCHEMES = {
  // Seaborn palettes (new defaults)
  seabornDeep: (ext) => {
    setSeabornPalette("deep");
    return schemeSeaborn11(ext);
  },
  seabornMuted: (ext) => {
    setSeabornPalette("muted");
    return schemeSeaborn11(ext);
  },
  seabornPastel: (ext) => {
    setSeabornPalette("pastel");
    return schemeSeaborn11(ext);
  },
  seabornBright: (ext) => {
    setSeabornPalette("bright");
    return schemeSeaborn11(ext);
  },
  seabornDark: (ext) => {
    setSeabornPalette("dark");
    return schemeSeaborn11(ext);
  },
  seabornColorblind: (ext) => {
    setSeabornPalette("colorblind");
    return schemeSeaborn11(ext);
  },
  // Legacy schemes
  schemeCat6: schemeCat6,
  schemeCat11: schemeCat11,
  schemeHue: schemeHue,
};

const COLOR_MODES = {
  colorByProp: colorByProp,
  colorBySizeBw: colorBySizeBw,
  colorBySize: colorBySize,
  colorByParentName: colorByParentName,
  colorByParent: colorByParent,
  colorByRandom: colorByRandom,
};

// Default to seaborn pastel scheme with colorByParent mode
let colorScheme =
  COLOR_SCHEMES[localStorage.color_extension_scheme] ||
  COLOR_SCHEMES.seabornPastel;
let fill = COLOR_MODES[localStorage.color_mode] || colorByParent;
// colorByProp // filetypes
// colorBySize // size
// colorByParentName colorful
// colorByParent // children
// byExtension

// Color switching functions
function switchColorMode(type) {
  fill = COLOR_MODES[type] || colorByProp;
  localStorage.color_mode = type;
  PluginManager.navigateTo(Navigation.currentPath());

  if (PluginManager.data)
    State.showWorking((done) => {
      PluginManager.cleanup();
      PluginManager.loadLast();
      done();
    });
}

function switchColorScheme(scheme) {
  localStorage.color_extension_scheme = scheme;
  colorScheme = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.seabornDeep;
  switchColorMode("colorByProp");
}

// Color change handler for Electrobun RPC messages
function updateColorScheme(type, value) {
  if (type === "scheme") {
    switchColorScheme(value);
  } else if (type === "mode") {
    switchColorMode(value);
  } else if (type === "darkMode") {
    toggleDarkMode(value === "toggle" ? !isDarkMode : value);
  } else if (type === "3dMode") {
    if (window.toggle3D) {
      window.toggle3D(value === "toggle" ? !window.RENDER_3D : value);
    }
  }
}

function colorByProp(d) {
  // using color prop
  return d.color;
}

var ext_reg = /\.\w+$/;

const tmpExtensions = new Set();
const randExt = {};

// Legacy hash-based rainbow scheme
function schemeHue(ext) {
  // Stable rainbow mapping: hash extension -> hue angle
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  if (!randExt[ext]) {
    const h = hashString(ext) % 360;
    // Increased saturation and adjusted lightness for more vibrancy
    const color = d3.hsl(h, 0.8, 0.52);
    randExt[ext] = color.toString();
  }
  return d3.lab(randExt[ext]);
}

function schemeCat6(ext) {
  if (ext in extension_categories_6) {
    return d3.lab(hue(extension_categories_6[ext]));
  }
}

function schemeCat11(ext) {
  if (ext in extension_categories_11) {
    return d3.lab(hue(extension_categories_11[ext]));
  }
}

function byExtension(d, def) {
  const m = ext_reg.exec(d.name);
  const ext = m && m[0];
  if (ext) {
    return colorScheme(ext);
  }

  return def ? null : d3.rgb(0, 0, 0);
}

const size_luminance = d3.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 50]);

function colorBySizeBw(d) {
  const c = d3.lab();
  c.l = size_luminance(d.value);
  return c;
}

const size_luminance2 = d3.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([50, 90]);

function colorBySize(d) {
  const c = d3.lab(size_scale_colors(d.value));
  c.l = size_luminance2(d.value);
  return c;
}

// TODO file size using domain on screen

// Cache for colorByParent to avoid repeated LAB conversions
const colorByParentCache = new WeakMap();

function colorByParent(d) {
  // Check cache first
  if (colorByParentCache.has(d)) {
    return colorByParentCache.get(d);
  }

  const p = getParent(d);
  // const c = d3.lab(hue(p.sum)); // size
  const c = d3.lab(hue(p.count)); // number
  // const c = d3.lab(hue(p.children ? p.children.length : 0))
  // c.l = luminance(d.value)
  c.l = depth_luminance(d.depth);

  colorByParentCache.set(d, c);
  return c;
}

function colorByParentName(d) {
  const p = getParent(d);
  const c = d3.lab(hue(p.name));
  c.l = size_luminance(d.sum || d.value);
  return c;
}

// Pseudo-random "confetti" color mode - assigns colors based on hashed identity
// Creates a chaotic, visually interesting effect with no semantic meaning
function colorByRandom(d) {
  // Hash the node's name + depth + value to create pseudo-random but stable color
  function hashNode(node) {
    const str =
      (node.name || "") + "|" + (node.depth || 0) + "|" + (node.value || 0);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const hash = hashNode(d);
  const index = hash % currentSeabornPalette.length;
  const hex = currentSeabornPalette[index];
  const c = d3.lab(hex);

  // Add some variation in lightness based on hash for extra chaos
  const lightnessVariation = ((hash >> 8) % 30) - 15; // -15 to +15
  c.l = Math.max(25, Math.min(85, c.l + lightnessVariation));

  return c;
}

function getParent(d) {
  let p = d;
  while (p.depth > 1) p = p.parent;
  return p;
}

/*
const _color_cache = new Map()
function color_cache(x) {
  if (!_color_cache.has(x)) {
    _color_cache.set(x, colorScale(x))
  }

  return _color_cache.get(x)
}
*/

function colorWalkNode(node) {
  const color = byExtension(node, true);
  if (color) {
    node.color = color;
    return;
  }

  const { children } = node;
  const len = children && children.length;
  if (!children || !len) {
    // Unknown files/empty dirs get a neutral warm gray
    node.color = d3.lab(65, 5, 10);
    return;
  }

  // size is orignal size, sum is calculated including all descendents
  const v = node.sum;

  let l = 0;
  let a = 0;
  let b = 0;

  for (let i = 0; i < len; i++) {
    const child = children[i];
    const color = child.color;
    const weight = v
      ? child.sum / v // weighted by size
      : 1 / len; // weighted by count

    l = l + color.l * weight;
    a = a + color.a * weight;
    b = b + color.b * weight;
  }

  // Preserve more color saturation in directories
  // Slightly boost chroma (a, b) to prevent muddy blending
  const chromaBoost = 1.15;
  a = a * chromaBoost;
  b = b * chromaBoost;

  // Adjust lightness: slightly darker cores look more saturated
  l = l * 0.97;
  l = Math.max(Math.min(95, l), 15);

  node.color = d3.lab(l, a, b);
}

function colorByTypes(data) {
  childrenFirst(data, colorWalkNode);
}

function childrenFirst(data, func) {
  const { children } = data;
  if (children) {
    children.forEach((v) => {
      childrenFirst(v, func);
    });
  }

  func(data);
}
