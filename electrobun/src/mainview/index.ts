/**
 * Space Radar - Electrobun WebView Renderer Entry Point
 *
 * This single bundled file replaces the 20+ script tags from the Electron version.
 * All modules are unified here with explicit scoping instead of globals.
 *
 * RPC replaces: ipcRenderer, localStorage IPC, temp file compressed IPC, webContents.send
 */

import { Electroview } from "electrobun/view";
import type { SpaceRadarRPC } from "../shared/types";

// =============================================================================
// D3 Setup - d3 v3 with augmentations
// =============================================================================

import * as d3 from "d3";
import * as d3Hierarchy from "d3-hierarchy";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";
import * as d3Ease from "d3-ease";
import { flamegraph } from "d3-flame-graph";
import { defaultFlamegraphTooltip } from "d3-flame-graph/dist/d3-flamegraph-tooltip.js";

// Merge d3 modules (d3 v3 base + newer modules)
// Note: Cannot Object.assign onto d3 directly because Bun's bundler wraps
// ESM namespace objects with getter-only property descriptors (readonly).
// Merge into a new plain object instead.
const d3Merged: any = Object.assign(
  {},
  d3,
  d3Hierarchy,
  d3Scale,
  d3Selection,
  d3Ease,
);

// =============================================================================
// Electroview RPC Setup
// =============================================================================

const rpc = Electroview.defineRPC<SpaceRadarRPC>({
  maxRequestTime: 300_000, // 5 minutes — must match bun side for long operations like selectFolder
  handlers: {
    requests: {},
    messages: {
      scanProgress(params) {
        progress(
          params.dir,
          params.name,
          params.size,
          params.fileCount,
          params.dirCount,
          params.errorCount,
        );
      },
      scanRefresh(_params) {
        // Try SQLite first; fall back to file-based preview
        electroview.rpc.request
          .getScanRootId({})
          .then((rootId) => {
            if (rootId) {
              return electroview.rpc.request.getSubtree({
                nodeId: rootId,
                depth: 3,
              });
            }
            // In-memory scanner mode — pull full tree from backend
            return electroview.rpc.request.loadScanPreview({});
          })
          .then((data) => {
            if (data) {
              try {
                const json = JSON.parse(data);
                currentViewRootId = json._nodeId ?? null;
                refresh(json);
              } catch (e) {
                console.error(
                  "[renderer] Failed to parse scanRefresh data:",
                  e,
                );
              }
            }
          })
          .catch((e) =>
            console.error("[renderer] Failed to load scan preview:", e),
          );
      },
      scanComplete(params) {
        // Try SQLite first; fall back to file-based preview
        electroview.rpc.request
          .getScanRootId({})
          .then((rootId) => {
            if (rootId) {
              return electroview.rpc.request.getSubtree({
                nodeId: rootId,
                depth: 5,
              });
            }
            return electroview.rpc.request.loadScanPreview({});
          })
          .then((data) => {
            if (data) {
              try {
                const json = JSON.parse(data);
                currentViewRootId = json._nodeId ?? null;
                complete(json, {
                  fileCount: params.stats.fileCount,
                  dirCount: params.stats.dirCount,
                  current_size: params.stats.currentSize,
                  errorCount: params.stats.errorCount,
                  cancelled: params.stats.cancelled,
                });
              } catch (e) {
                console.error(
                  "[renderer] Failed to parse scanComplete data:",
                  e,
                );
                // Reset scanning state so the UI doesn't stay stuck
                isScanning = false;
                isPaused = false;
                updateScanButtons();
                legend.style("display", "none");
                lightbox(false);
                bottomStatus.textContent =
                  "Error: failed to parse scan results";
              }
            } else {
              // No data returned — still reset scanning state
              isScanning = false;
              isPaused = false;
              updateScanButtons();
              legend.style("display", "none");
              lightbox(false);
              bottomStatus.textContent = "Scan complete but no data returned";
            }
          })
          .catch((e) => {
            console.error("[renderer] Failed to load scan preview:", e);
            // Reset scanning state so the UI doesn't stay stuck
            isScanning = false;
            isPaused = false;
            updateScanButtons();
            legend.style("display", "none");
            lightbox(false);
            bottomStatus.textContent = "Error: failed to load scan results";
          });
      },
      scanError(params) {
        console.error("[renderer] Scan error:", params.error);
        isScanning = false;
        isPaused = false;
        updateScanButtons();
        legend.style("display", "none");
        lightbox(false);
        bottomStatus.textContent = "Error: " + params.error;
      },
      colorChange(params) {
        if (params.type === "scheme") {
          switchColorScheme(params.value);
        } else if (params.type === "mode") {
          switchColorMode(params.value);
        } else if (params.type === "darkMode") {
          toggleDarkMode(params.value === "true" || params.value === true);
        }
      },
      contextMenuClicked(params) {
        if (params.action === "show-selection") {
          showSelection();
        } else if (params.action === "open-selection") {
          openSelection();
        } else if (params.action === "trash-selection") {
          trashSelection();
        }
      },
    },
  },
});
const electroview = new Electroview({ rpc });

// ---------------------------------------------------------------------------
// SQLite lazy-loading state
// ---------------------------------------------------------------------------

/** Depth used when fetching subtrees for drill-down navigation. */
const LAZY_LOAD_DEPTH = 5;

/** Node ID of the current view root in the SQLite scan DB. */
let currentViewRootId: number | null = null;

// =============================================================================
// UTILS (from app/js/utils.js)
// =============================================================================

function format(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes as number)) {
    return "0 B";
  }

  const kb = bytes / 1024;
  const mb = bytes / 1024 / 1024;
  const gb = bytes / 1024 / 1024 / 1024;
  const tb = bytes / 1024 / 1024 / 1024 / 1024;

  const units: Record<string, number> = { KB: kb, MB: mb, GB: gb, TB: tb };

  let last_unit = "B";
  let last_value: string = String(bytes);
  for (const u in units) {
    if (units[u] < 1) {
      return last_value + " " + last_unit;
    }
    last_unit = u;
    last_value = units[u].toFixed(2);
  }
  return last_value + " " + last_unit;
}

let last_time = Date.now();

function fmt_time(ms: number): string {
  const s = ms / 1000;
  const m = s / 60;

  if (s < 10) return ms + "ms";
  if (m < 1) return s.toFixed(2) + "s";

  const sRem = (s % 60) | 0;
  const sStr = sRem === 0 ? "00" : sRem > 10 ? String(sRem) : "0" + sRem;
  return (m | 0) + ":" + sStr + "m";
}

function log(...args: any[]): void {
  const now = Date.now();
  const elapsed = fmt_time(now - last_time);
  last_time = now;
  console.log(elapsed + "\t", ...args);
}

// TimeoutTask: runs a task in the future, cancels previous if rescheduled
class TimeoutTask {
  id: ReturnType<typeof setTimeout> | null = null;
  task: ((schedule: (t?: number) => void) => void) | null;
  time: number;

  constructor(
    task: ((schedule: (t?: number) => void) => void) | null,
    time: number,
  ) {
    this.task = task;
    this.time = time;
  }

  cancel(): void {
    if (this.id !== null) {
      clearTimeout(this.id);
      this.id = null;
    }
  }

  schedule(t?: number): void {
    this.time = t !== undefined ? t : this.time;
    this.cancel();
    this.id = setTimeout(() => this.run(), this.time);
  }

  run(): void {
    this.cancel();
    if (this.task) this.task((t?: number) => this.schedule(t));
  }
}

// TimeoutRAFTask: runs task on requestAnimationFrame
class TimeoutRAFTask {
  id: number | null = null;
  task: ((next: () => void) => void) | null;

  constructor(task: ((next: () => void) => void) | null) {
    this.task = task;
  }

  cancel(): void {
    if (this.id !== null) {
      cancelAnimationFrame(this.id);
      this.id = null;
    }
  }

  run(): void {
    if (this.task) {
      this.cancel();
      this.id = requestAnimationFrame(() => {
        this.task!(() => this.run());
      });
    }
  }
}

// TaskChecker: poll-based task runner
class TaskChecker {
  running = false;
  task: ((schedule: (t?: number) => void) => void) | null;
  time: number;
  scheduled: number;

  constructor(
    task: ((schedule: (t?: number) => void) => void) | null,
    time: number,
  ) {
    this.task = task;
    this.time = time;
    this.scheduled = Date.now() + time;
  }

  cancel(): void {
    this.running = false;
  }

  schedule(t?: number): void {
    this.running = true;
    this.time = t !== undefined ? t : this.time;
    this.scheduled = Date.now() + this.time;
  }

  run(): void {
    if (this.task) this.task((t?: number) => this.schedule(t));
  }

  check(): void {
    if (!this.running) return;
    const now = Date.now();
    if (now - this.scheduled >= 0) {
      this.run();
    }
  }
}

// =============================================================================
// GRAPHS (from app/js/graphs.js)
// =============================================================================

const PATH_DELIMITER = "/";

function keys(d: any): string[] {
  return getPath(d).map((v: any) => v.name);
}

function key(d: any): string {
  return keys(d).join(PATH_DELIMITER);
}

function getPath(d: any): any[] {
  const path = [d];
  let node = d.parent;
  while (node) {
    path.unshift(node);
    node = node.parent;
  }
  return path;
}

function getNodeFromPath(pathKeys: string[], root: any): any {
  if (!pathKeys.length) {
    log("warning no keys to navigate to");
    return root;
  }

  let n = root;
  let i = 0;
  let name = pathKeys[i++];

  if (i >= pathKeys.length) {
    if (name !== n.name) {
      log("warning, root name dont match!");
    }
    return n;
  }

  while (i < pathKeys.length && (name = pathKeys[i++])) {
    const children = n.children
      ? n.children.filter((c: any) => c.name === name)
      : [];
    if (!children[0]) return n;
    n = children[0];
  }

  return n;
}

// =============================================================================
// FILE EXTENSIONS (from app/js/file_extensions.js)
// =============================================================================

const extension_categories_11_raw: Record<string, string> = {
  archive:
    "7z,a,apk,ar,bz2,cab,cpio,deb,dmg,egg,gz,iso,jar,lha,mar,pea,rar,rpm,s7z,shar,tar,tbz2,tgz,tlz,war,whl,xpi,zip,zipx,deb,rpm,xz,pak,crx,exe,msi,bin",
  audio:
    "aac,aiff,ape,au,flac,gsm,it,m3u,m4a,mid,mod,mp3,mpa,pls,ra,s3m,sid,wav,wma,xm",
  code: "c,cc,class,clj,cpp,cs,cxx,el,go,h,java,lua,m,m4,php,pl,po,py,rb,rs,sh,swift,vb,vcxproj,xcodeproj,xml,diff,patch",
  font: "eot,otf,ttf,woff,woff2",
  image:
    "3dm,3ds,max,bmp,dds,gif,jpg,jpeg,png,psd,xcf,tga,thm,tif,tiff,yuv,ai,eps,ps,svg,dwg,dxf,gpx,kml,kmz,webp",
  sheet: "ods,xls,xlsx,csv,ics,vcf",
  slide: "ppt,odp",
  text: "doc,docx,ebook,log,md,msg,odt,org,pages,pdf,rtf,rst,tex,txt,wpd,wps",
  video:
    "3g2,3gp,aaf,asf,avchd,avi,drc,flv,m2v,m4p,m4v,mkv,mng,mov,mp2,mp4,mpe,mpeg,mpg,mpv,mxf,nsv,ogg,ogv,ogm,qt,rm,rmvb,roq,srt,svi,vob,webm,wmv,yuv",
  web: "html,htm,css,js,jsx,less,scss,wasm",
};

const extension_categories_6_raw: Record<string, string> = {
  media:
    "aac,au,flac,mid,midi,mka,mp3,mpc,ogg,opus,ra,wav,m4a,axa,oga,spx,xspf,mov,MOV,mpg,mpeg,m2v,mkv,ogm,mp4,m4v,mp4v,vob,qt,nuv,wmv,asf,rm,rmvb,flc,avi,fli,flv,gl,m2ts,divx,webm,axv,anx,ogv,ogx",
  image:
    "jpg,JPG,jpeg,gif,bmp,pbm,pgm,ppm,tga,xbm,xpm,tif,tiff,png,PNG,svg,svgz,mng,pcx,dl,xcf,xwd,yuv,cgm,emf,eps,CR2,ico",
  code: "tex,rdf,owl,n3,ttl,nt,torrent,xml,*Makefile,*Rakefile,*Dockerfile,*build.xml,*rc,*1,nfo,*README,*README.txt,*readme.txt,md,*README.markdown,ini,yml,cfg,conf,h,hpp,c,cpp,cxx,cc,objc,sqlite,go,sql,csv",
  archive:
    "tar,tgz,arj,taz,lzh,lzma,tlz,txz,zip,z,Z,dz,gz,lz,xz,bz2,bz,tbz,tbz2,tz,deb,rpm,jar,rar,ace,zoo,cpio,7z,rz,apk,gem",
  obj: "log,bak,aux,lof,lol,lot,out,toc,bbl,blg,*,part,incomplete,swp,tmp,temp,o,pyc,class,cache",
  doc: "doc,docx,rtf,odt,dot,dotx,ott,xls,xlsx,ods,ots,ppt,pptx,odp,otp,fla,psd",
};

function build_reverse_map(
  map: Record<string, string>,
): Record<string, string> {
  const reverse_map: Record<string, string> = {};
  for (const type in map) {
    map[type]
      .split(",")
      .map((e) => `.${e}`)
      .forEach((k) => {
        reverse_map[k] = type;
      });
  }
  return reverse_map;
}

const extension_categories_11 = build_reverse_map(extension_categories_11_raw);
const extension_categories_6 = build_reverse_map(extension_categories_6_raw);

// =============================================================================
// COLORS (from app/js/colors.js)
// =============================================================================

const size_scales = [0, 1e3, 1e5, 1e6, 1e8, 1e9, 1e12, 1e14, 1e15];

const hue = d3Merged.scale.category10();

const color_range = d3Merged.scale
  .linear()
  .range(["#000004", "#fcffa4"])
  .interpolate(d3Merged.interpolateLab);

const size_scale_colors = d3Merged.scale
  .linear()
  .domain(size_scales)
  .clamp(true)
  .range(["#000004", "#fcffa4"]);

const depth_luminance = d3Merged.scale
  .linear()
  .domain([0, 11])
  .clamp(true)
  .range([75, 96]);

const greyScale = d3Merged.scale
  .linear()
  .range(["black", "white"])
  .domain([0, 12])
  .clamp(true);

// Seaborn palettes
const SEABORN_DEEP = [
  "#4C72B0",
  "#DD8452",
  "#55A868",
  "#C44E52",
  "#8172B3",
  "#937860",
  "#DA8BC3",
  "#8C8C8C",
  "#CCB974",
  "#64B5CD",
];
const SEABORN_MUTED = [
  "#4878D0",
  "#EE854A",
  "#6ACC64",
  "#D65F5F",
  "#956CB4",
  "#8C613C",
  "#DC7EC0",
  "#797979",
  "#D5BB67",
  "#82C6E2",
];
const SEABORN_PASTEL = [
  "#A1C9F4",
  "#FFB482",
  "#8DE5A1",
  "#FF9F9B",
  "#D0BBFF",
  "#DEBB9B",
  "#FAB0E4",
  "#CFCFCF",
  "#FFFEA3",
  "#B9F2F0",
];
const SEABORN_BRIGHT = [
  "#023EFF",
  "#FF7C00",
  "#1AC938",
  "#E8000B",
  "#8B2BE2",
  "#9F4800",
  "#F14CC1",
  "#A3A3A3",
  "#FFC400",
  "#00D7FF",
];
const SEABORN_DARK = [
  "#001C7F",
  "#B1400D",
  "#12711C",
  "#8C0800",
  "#591E71",
  "#592F0D",
  "#A23582",
  "#3C3C3C",
  "#B8850A",
  "#006374",
];
const SEABORN_COLORBLIND = [
  "#0173B2",
  "#DE8F05",
  "#029E73",
  "#D55E00",
  "#CC78BC",
  "#CA9161",
  "#FBAFE4",
  "#949494",
  "#ECE133",
  "#56B4E9",
];

const CATEGORY_TO_INDEX_11: Record<string, number> = {
  code: 0,
  video: 1,
  audio: 2,
  archive: 3,
  image: 4,
  font: 5,
  slide: 6,
  sheet: 7,
  text: 8,
  web: 9,
};

const CATEGORY_TO_INDEX_6: Record<string, number> = {
  code: 0,
  media: 1,
  image: 4,
  archive: 3,
  doc: 2,
  obj: 7,
};

const seabornCache: Record<string, any> = {};
let currentSeabornPalette = SEABORN_DEEP;
let currentPaletteName = "deep";

function setSeabornPalette(name: string): void {
  const palettes: Record<string, string[]> = {
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
    Object.keys(seabornCache).forEach((k) => delete seabornCache[k]);
  }
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function schemeSeabornHash(ext: string): any {
  const cacheKey = `${currentPaletteName}_hash_${ext}`;
  if (seabornCache[cacheKey]) return seabornCache[cacheKey];

  const index = hashString(ext) % currentSeabornPalette.length;
  const hex = currentSeabornPalette[index];
  const lab = d3Merged.lab(hex);
  seabornCache[cacheKey] = lab;
  return lab;
}

function schemeSeaborn11(ext: string): any {
  const cacheKey = `${currentPaletteName}_11_${ext}`;
  if (seabornCache[cacheKey]) return seabornCache[cacheKey];

  if (ext in extension_categories_11) {
    const category = extension_categories_11[ext];
    const index = CATEGORY_TO_INDEX_11[category];
    if (index !== undefined) {
      const hex = currentSeabornPalette[index % currentSeabornPalette.length];
      const lab = d3Merged.lab(hex);
      seabornCache[cacheKey] = lab;
      return lab;
    }
  }
  return schemeSeabornHash(ext);
}

function schemeSeaborn6(ext: string): any {
  const cacheKey = `${currentPaletteName}_6_${ext}`;
  if (seabornCache[cacheKey]) return seabornCache[cacheKey];

  if (ext in extension_categories_6) {
    const category = extension_categories_6[ext];
    const index = CATEGORY_TO_INDEX_6[category];
    if (index !== undefined) {
      const hex = currentSeabornPalette[index % currentSeabornPalette.length];
      const lab = d3Merged.lab(hex);
      seabornCache[cacheKey] = lab;
      return lab;
    }
  }
  return schemeSeabornHash(ext);
}

// Dark mode
let isDarkMode = localStorage.getItem("dark_mode") === "true";

function toggleDarkMode(enabled: any): void {
  isDarkMode = !!enabled;
  localStorage.setItem("dark_mode", enabled ? "true" : "false");

  if (enabled) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  if (PluginManager.data) {
    State.showWorking((done: () => void) => {
      PluginManager.cleanup();
      PluginManager.loadLast();
      done();
    });
  }
}

if (isDarkMode) {
  document.body.classList.add("dark-mode");
}

// Legacy schemes
const ext_reg = /\.\w+$/;
const randExt: Record<string, string> = {};

function schemeHue(ext: string): any {
  if (!randExt[ext]) {
    const h = hashString(ext) % 360;
    const color = d3Merged.hsl(h, 0.8, 0.52);
    randExt[ext] = color.toString();
  }
  return d3Merged.lab(randExt[ext]);
}

function schemeCat6(ext: string): any {
  if (ext in extension_categories_6) {
    return d3Merged.lab(hue(extension_categories_6[ext]));
  }
}

function schemeCat11(ext: string): any {
  if (ext in extension_categories_11) {
    return d3Merged.lab(hue(extension_categories_11[ext]));
  }
}

// Color schemes map
const COLOR_SCHEMES: Record<string, (ext: string) => any> = {
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
  schemeCat6,
  schemeCat11,
  schemeHue,
};

// Color by extension
function byExtension(d: any, def?: boolean): any {
  const m = ext_reg.exec(d.name);
  const ext = m && m[0];
  if (ext) {
    return colorScheme(ext);
  }
  return def ? null : d3Merged.rgb(0, 0, 0);
}

// Color mode functions
function colorByProp(d: any): any {
  return d.color;
}

const size_luminance = d3Merged.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 50]);

function colorBySizeBw(d: any): any {
  const c = d3Merged.lab(0, 0, 0);
  c.l = size_luminance(d.value);
  return c;
}

const size_luminance2 = d3Merged.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([50, 90]);

function colorBySize(d: any): any {
  const c = d3Merged.lab(size_scale_colors(d.value));
  c.l = size_luminance2(d.value);
  return c;
}

function getParent(d: any): any {
  let p = d;
  while (p.depth > 1) p = p.parent;
  return p;
}

const colorByParentCache = new WeakMap();

function colorByParent(d: any): any {
  if (colorByParentCache.has(d)) {
    return colorByParentCache.get(d);
  }
  const p = getParent(d);
  const c = d3Merged.lab(hue(p.count));
  c.l = depth_luminance(d.depth);
  colorByParentCache.set(d, c);
  return c;
}

function colorByParentName(d: any): any {
  const p = getParent(d);
  const c = d3Merged.lab(hue(p.name));
  c.l = size_luminance(d.sum || d.value);
  return c;
}

function colorByRandom(d: any): any {
  const str = (d.name || "") + "|" + (d.depth || 0) + "|" + (d.value || 0);
  const hash = hashString(str);
  const index = hash % currentSeabornPalette.length;
  const hex = currentSeabornPalette[index];
  const c = d3Merged.lab(hex);
  const lightnessVariation = ((hash >> 8) % 30) - 15;
  c.l = Math.max(25, Math.min(85, c.l + lightnessVariation));
  return c;
}

const COLOR_MODES: Record<string, (d: any) => any> = {
  colorByProp,
  colorBySizeBw,
  colorBySize,
  colorByParentName,
  colorByParent,
  colorByRandom,
};

let colorScheme =
  COLOR_SCHEMES[localStorage.getItem("color_extension_scheme") || ""] ||
  COLOR_SCHEMES.seabornPastel;
let fill =
  COLOR_MODES[localStorage.getItem("color_mode") || ""] || colorByParent;

function switchColorMode(type: string): void {
  fill = COLOR_MODES[type] || colorByProp;
  localStorage.setItem("color_mode", type);
  PluginManager.navigateTo(Navigation.currentPath());

  if (PluginManager.data) {
    State.showWorking((done: () => void) => {
      PluginManager.cleanup();
      PluginManager.loadLast();
      done();
    });
  }
}

function switchColorScheme(scheme: string): void {
  localStorage.setItem("color_extension_scheme", scheme);
  colorScheme = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.seabornDeep;
  switchColorMode("colorByProp");
}

// Tree coloring
function colorWalkNode(node: any): void {
  const color = byExtension(node, true);
  if (color) {
    node.color = color;
    return;
  }

  const { children } = node;
  const len = children && children.length;
  if (!children || !len) {
    node.color = d3Merged.lab(65, 5, 10);
    return;
  }

  const v = node.sum;
  let l = 0,
    a = 0,
    b = 0;

  for (let i = 0; i < len; i++) {
    const child = children[i];
    const clr = child.color;
    const weight = v ? child.sum / v : 1 / len;
    l += clr.l * weight;
    a += clr.a * weight;
    b += clr.b * weight;
  }

  const chromaBoost = 1.15;
  a = a * chromaBoost;
  b = b * chromaBoost;
  l = l * 0.97;
  l = Math.max(Math.min(95, l), 15);

  node.color = d3Merged.lab(l, a, b);
}

function childrenFirst(data: any, func: (d: any) => void): void {
  const { children } = data;
  if (children) {
    children.forEach((v: any) => childrenFirst(v, func));
  }
  func(data);
}

function colorByTypes(data: any): void {
  childrenFirst(data, colorWalkNode);
}

// =============================================================================
// DATA PROCESSING (from app/js/data.js)
// =============================================================================

let partition: any;

function one(): number {
  return 1;
}

function sizeValue(d: any): number {
  return d.size;
}

function countIsValue(d: any): void {
  d.count = d.value;
}

function sumAndHideChildren(d: any): void {
  d._children = d.children;
  d.sum = d.value;
}

function computeNodeCount(data: any): void {
  console.time("computeNodeCount");
  partition.value(one).nodes(data).forEach(countIsValue);
  console.timeEnd("computeNodeCount");
}

function computeNodeSize(data: any): void {
  console.time("computeNodeSize");
  partition.value(sizeValue).nodes(data).forEach(sumAndHideChildren);
  console.timeEnd("computeNodeSize");
}

function setNodeFilter(data: any): any {
  const LEVELS = 11;
  const HIDE_THRESHOLD = 0.1;

  return partition.children(function hideChildren(d: any, depth: number) {
    if (depth >= LEVELS) return null;
    if (!d._children) return null;

    const visibleChildren: any[] = [];
    const hiddenChildren: any[] = [];

    d._children.forEach((c: any) => {
      if ((c.sum / d.sum) * 100 > HIDE_THRESHOLD) {
        visibleChildren.push(c);
      } else {
        hiddenChildren.push(c);
      }
    });

    if (hiddenChildren.length > 0) {
      let otherSum = 0;
      let otherCount = 0;
      hiddenChildren.forEach((c: any) => {
        otherSum += c.sum;
        otherCount += c.count;
      });

      const otherNode = {
        name: `Other files (${hiddenChildren.length} items)`,
        sum: otherSum,
        count: otherCount,
        size: otherSum,
        value: otherSum,
        depth: d.depth + 1,
        parent: d,
        _children: null,
        children: null,
        _isOtherFiles: true,
        color: d3Merged.lab(85, 0, 0),
      };
      visibleChildren.push(otherNode);
    }

    return visibleChildren;
  });
}

function namesort(a: any, b: any): number {
  return d3Merged.ascending(a.name, b.name);
}

// =============================================================================
// CHART BASE (from app/js/chart.js)
// =============================================================================

class Chart {
  resize(): void {}
  generate(_data: any): void {}
  navigateTo(_path: string[], _current?: any, _root?: any): void {}
  showMore(): void {}
  showLess(): void {}
  cleanup(): void {}
  highlightPath?(_path?: string[] | null, _node?: any, _root?: any): void;
}

// =============================================================================
// SUNBURST (from app/js/sunburst.js)
// =============================================================================

function SunBurst() {
  let LEVELS = 11;
  const INNER_LEVEL = 7;
  const USE_COUNT = 0;
  const ANIMATION_DURATION = 300;

  let rootNode: any = null;
  let currentNode: any = null;
  let hoveredNode: any = null;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width: number, height: number, centerX: number, centerY: number;
  let radius: number,
    CORE_RADIUS: number,
    OUTER_RADIUS: number,
    FLEXI_LEVEL: number;

  let visibleNodes: any[] = [];
  let animationStart: number | null = null;
  let isAnimating = false;

  const drawer = new TimeoutRAFTask(draw);

  let core_top: HTMLElement | null;
  let core_center: HTMLElement | null;
  let core_tag: HTMLElement | null;

  function init() {
    canvas = document.getElementById("sunburst-canvas") as HTMLCanvasElement;
    if (!canvas) {
      console.error("[sunburst] Canvas element not found");
      return;
    }
    ctx = canvas.getContext("2d")!;

    core_top = document.getElementById("core_top");
    core_center = document.getElementById("core_center");
    core_tag = document.getElementById("core_tag");

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseout", onMouseOut);
    canvas.addEventListener("click", onClick);

    const explanation = document.getElementById("explanation");
    if (explanation) {
      explanation.addEventListener("click", () => {
        if (currentNode && currentNode.parent) {
          State.navigateTo(keys(currentNode.parent));
        } else if (currentNode && currentNode._parentNodeId) {
          fetchAndDisplaySubtree(currentNode._parentNodeId);
        }
      });
    }

    calcDimensions();
  }

  function calcDimensions() {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");

    width = window.innerWidth;
    height =
      window.innerHeight -
      (header ? header.getBoundingClientRect().height : 0) -
      (footer ? footer.getBoundingClientRect().height : 0);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    centerX = width / 2;
    centerY = height / 2;

    const len = Math.min(width, height);
    radius = len * 0.45;
    CORE_RADIUS = radius * 0.4;
    OUTER_RADIUS = radius - CORE_RADIUS;
    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL);
  }

  function draw(next: () => void) {
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    let t = 1;
    if (isAnimating && animationStart) {
      const elapsed = Date.now() - animationStart;
      t = Math.min(elapsed / ANIMATION_DURATION, 1);
      t = easeOutCubic(t);
      if (t >= 1) {
        isAnimating = false;
        animationStart = null;
      }
    }

    for (let i = 0; i < visibleNodes.length; i++) {
      drawArc(visibleNodes[i], t);
    }

    drawCenter();
    ctx.restore();

    if (isAnimating) next();
  }

  function drawArc(node: any, t: number) {
    const d = node.data;

    const startAngle = lerp(node.fromStartAngle, node.startAngle, t);
    const endAngle = lerp(node.fromEndAngle, node.endAngle, t);
    const innerR = lerp(node.fromInnerR, node.innerR, t);
    const outerR = lerp(node.fromOuterR, node.outerR, t);

    if (endAngle - startAngle < 0.002) return;
    if (outerR - innerR < 1) return;

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerR, endAngle, startAngle, true);
    ctx.closePath();

    let color;
    if (d._isFreeSpace) {
      color = "#e8e8e8";
    } else {
      color = fill(d);
    }

    if (color && typeof color.toString === "function") {
      ctx.fillStyle = color.toString();
    } else if (color) {
      ctx.fillStyle = color;
    } else {
      ctx.fillStyle = "#888";
    }

    if (hoveredNode) {
      ctx.globalAlpha = isAncestorOrDescendant(d, hoveredNode) ? 1 : 0.3;
    } else {
      ctx.globalAlpha = 0.85;
    }

    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = Math.max(0.25, 1.0 - (d.depth - currentNode.depth) * 0.08);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawCenter() {
    ctx.beginPath();
    ctx.arc(centerX, centerY, CORE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hoveredNode
      ? "rgba(238, 238, 238, 0.5)"
      : "rgba(238, 238, 238, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function hitTest(mouseX: number, mouseY: number): any {
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (distance <= CORE_RADIUS) {
      return { type: "center", node: currentNode };
    }

    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const node = visibleNodes[i];
      if (distance >= node.innerR && distance <= node.outerR) {
        const nodeStart = normalizeAngle(node.startAngle);
        const nodeEnd = normalizeAngle(node.endAngle);
        const testAngle = normalizeAngle(angle);

        let inArc = false;
        if (nodeStart <= nodeEnd) {
          inArc = testAngle >= nodeStart && testAngle <= nodeEnd;
        } else {
          inArc = testAngle >= nodeStart || testAngle <= nodeEnd;
        }

        if (inArc) return { type: "arc", node: node.data };
      }
    }
    return null;
  }

  function normalizeAngle(angle: number): number {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }

  function onMouseMove(e: MouseEvent) {
    if (!currentNode) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = hitTest(mouseX, mouseY);
    const newHovered = hit ? hit.node : null;

    if (newHovered !== hoveredNode) {
      hoveredNode = newHovered;
      if (hoveredNode) {
        updateCore(hoveredNode);
        State.highlightPath(keys(hoveredNode));
      } else {
        if (currentNode) updateCore(currentNode);
        State.highlightPath();
      }
      scheduleDraw();
    }
  }

  function onMouseOut() {
    if (hoveredNode) {
      hoveredNode = null;
      if (currentNode) updateCore(currentNode);
      State.highlightPath();
      scheduleDraw();
    }
  }

  function onClick(e: MouseEvent) {
    if (!currentNode) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hit = hitTest(mouseX, mouseY);
    if (!hit) return;

    if (hit.type === "center") {
      if (currentNode && currentNode.parent) {
        State.navigateTo(keys(currentNode.parent));
      } else if (currentNode && currentNode._parentNodeId) {
        fetchAndDisplaySubtree(currentNode._parentNodeId);
      }
    } else if (hit.type === "arc") {
      let node = hit.node;
      if (node._isOtherFiles || node._isFreeSpace) return;
      if (node.depth - currentNode.depth > 1) {
        node = node.parent;
      }
      if (node && (node._children || node.children)) {
        State.navigateTo(keys(node));
      }
    }
  }

  function updateCore(d: any) {
    if (!d) return;
    const baseNode = currentNode || rootNode;
    const percent = baseNode
      ? ((d.sum / baseNode.sum) * 100).toFixed(2) + "%"
      : "";

    if (core_top) core_top.innerHTML = d.name || "";
    if (core_center)
      core_center.innerHTML = format(d.sum).split(" ").join("<br/>");
    if (core_tag) core_tag.innerHTML = percent + "<br/>";
  }

  function zoom(node: any) {
    if (!node) return;

    const oldNodes = visibleNodes.slice();
    const oldNodeMap = new Map<string, any>();
    oldNodes.forEach((n) => oldNodeMap.set(key(n.data), n));

    currentNode = node;
    updateCore(node);
    computeVisibleNodes(node);

    visibleNodes.forEach((n) => {
      const k = key(n.data);
      const old = oldNodeMap.get(k);
      if (old) {
        n.fromStartAngle = old.startAngle;
        n.fromEndAngle = old.endAngle;
        n.fromInnerR = old.innerR;
        n.fromOuterR = old.outerR;
      } else {
        const midAngle = (n.startAngle + n.endAngle) / 2;
        n.fromStartAngle = midAngle;
        n.fromEndAngle = midAngle;
        n.fromInnerR = CORE_RADIUS;
        n.fromOuterR = CORE_RADIUS;
      }
    });

    isAnimating = true;
    animationStart = Date.now();
    scheduleDraw();
  }

  function computeVisibleNodes(node: any) {
    if (!node) return;

    setNodeFilter(node);
    const nodes = partition.nodes(node).slice(1);

    let maxDepth = 0;
    nodes.forEach((n: any) => {
      const relativeDepth = n.depth - node.depth;
      if (relativeDepth > maxDepth) maxDepth = relativeDepth;
    });

    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL, maxDepth);
    if (FLEXI_LEVEL < 1) FLEXI_LEVEL = 1;

    visibleNodes = [];
    const ADJUSTMENT = -Math.PI / 2;

    nodes.forEach((d: any) => {
      const relativeDepth = d.depth - node.depth;
      if (relativeDepth > LEVELS || relativeDepth < 1) return;

      let innerR =
        CORE_RADIUS + (OUTER_RADIUS / FLEXI_LEVEL) * (relativeDepth - 1);
      const outerR =
        CORE_RADIUS + (OUTER_RADIUS / FLEXI_LEVEL) * relativeDepth - 1;

      if (innerR < 0) innerR = 0;
      if (outerR <= innerR) return;

      visibleNodes.push({
        data: d,
        startAngle: d.x + ADJUSTMENT,
        endAngle: d.x + d.dx + ADJUSTMENT - 0.005,
        innerR,
        outerR,
        fromStartAngle: d.x + ADJUSTMENT,
        fromEndAngle: d.x + d.dx + ADJUSTMENT - 0.005,
        fromInnerR: innerR,
        fromOuterR: outerR,
      });
    });

    visibleNodes.sort((a: any, b: any) => a.data.depth - b.data.depth);
  }

  function generateSunburst(root: any) {
    rootNode = root;
    currentNode = root;

    partition = d3Merged.layout.partition();
    partition
      .value((d: any) => d.size)
      .sort(namesort)
      .size([2 * Math.PI, radius]);

    computeNodeCount(root);
    computeNodeSize(root);

    console.time("color");
    colorByTypes(root);
    console.timeEnd("color");

    log("Root count", root.count, "ROOT size", format(root.value));

    setNodeFilter(root).value((d: any) => (USE_COUNT ? d.count : d.sum));

    computeVisibleNodes(root);
    updateCore(root);

    visibleNodes.forEach((n) => {
      n.fromStartAngle = n.startAngle;
      n.fromEndAngle = n.endAngle;
      n.fromInnerR = n.innerR;
      n.fromOuterR = n.outerR;
    });

    scheduleDraw();
  }

  function scheduleDraw() {
    drawer.run();
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function isAncestorOrDescendant(a: any, b: any): boolean {
    if (!a || !b) return false;
    let node: any = b;
    while (node) {
      if (node === a) return true;
      node = node.parent;
    }
    node = a;
    while (node) {
      if (node === b) return true;
      node = node.parent;
    }
    return false;
  }

  init();

  return {
    resize() {
      calcDimensions();
      if (currentNode) {
        computeVisibleNodes(currentNode);
        visibleNodes.forEach((n) => {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },
    generate: generateSunburst,
    showMore() {
      LEVELS++;
      if (currentNode) {
        computeVisibleNodes(currentNode);
        visibleNodes.forEach((n) => {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },
    showLess() {
      if (LEVELS <= 1) return;
      LEVELS--;
      if (currentNode) {
        computeVisibleNodes(currentNode);
        visibleNodes.forEach((n) => {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },
    cleanup() {
      rootNode = null;
      currentNode = null;
      hoveredNode = null;
      visibleNodes = [];
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        ctx.restore();
      }
    },
    navigateTo(targetKeys: string[]) {
      if (!rootNode) return;
      const n = getNodeFromPath(targetKeys, rootNode);
      if (n) zoom(n);
    },
    highlightPath(_path: string[] | null | undefined, node?: any) {
      const newHovered = node || null;
      if (newHovered !== hoveredNode) {
        hoveredNode = newHovered;
        if (hoveredNode) {
          updateCore(hoveredNode);
        } else if (currentNode) {
          updateCore(currentNode);
        }
        scheduleDraw();
      }
    },
  };
}

// =============================================================================
// TREEMAP (from app/js/treemap.js)
// =============================================================================

function TreeMap() {
  let width = window.innerWidth;
  let height =
    window.innerHeight -
    (document.querySelector("header")?.getBoundingClientRect().height || 0) -
    (document.querySelector("footer")?.getBoundingClientRect().height || 0);

  let xd = d3Merged.scale.linear().domain([0, width]).range([0, width]);
  let yd = d3Merged.scale.linear().domain([0, height]).range([0, height]);

  let textHeight: number;

  const drawer = new TimeoutRAFTask(draw);
  const canceller = new TimeoutTask(() => {
    drawer.cancel();
  }, 500);

  function drawThenCancel() {
    drawer.run();
    canceller.schedule();
  }

  function isPointInRect(
    mx: number,
    my: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  let treemap: any;

  function mktreemap() {
    treemap = d3Merged.layout
      .treemap()
      .round(false)
      .sort((a: any, b: any) => a.value - b.value)
      .value((d: any) => d.size);
  }

  mktreemap();

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  function onResize() {
    width = window.innerWidth;
    height =
      window.innerHeight -
      (document.querySelector("header")?.getBoundingClientRect().height || 0) -
      (document.querySelector("footer")?.getBoundingClientRect().height || 0);

    xd = d3Merged.scale.linear().domain([0, width]).range([0, width]);
    yd = d3Merged.scale.linear().domain([0, height]).range([0, height]);

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.font = "10px Tahoma";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const metrics = ctx.measureText("M");
    textHeight = metrics.width;

    if (currentNode) navigateTo(currentNode);
  }

  // FakeSVG: intermediate representation for d3 join pattern on canvas
  class FakeSVG {
    objects: any[] = [];
    map = new Map<string, any>();
    keyFn: (d: any) => string;
    sorter: ((a: any, b: any) => number) | null = null;

    constructor(keyFn: (d: any) => string) {
      this.keyFn = keyFn;
    }

    data(data: any[]): any[] {
      const map = this.map;
      const enter: any[] = [];

      this.objects.forEach((o) => (o.__remove__ = true));

      for (let i = 0, il = data.length; i < il; i++) {
        const d = data[i];
        const k = this.keyFn(d);
        let o;
        if (!map.has(k)) {
          o = {};
          enter.push(o);
          map.set(k, o);
        }
        o = map.get(k);
        o.__data__ = d;
        o.__remove__ = false;
      }

      this.updateObjects();
      return enter;
    }

    sort(func?: (a: any, b: any) => number) {
      if (func) this.sorter = func;
      if (this.sorter) this.objects.sort(this.sorter);
    }

    updateObjects() {
      this.objects = [...this.map.values()];
    }
  }

  const fake_svg = new FakeSVG(key);
  let nnn: any;

  let USE_GAP = 0;
  let USE_BORDERS = 1;
  let TREEMAP_LEVELS = 2;
  const BENCH = 0;
  let mouseclicked: boolean;
  let mousex = -1;
  let mousey = -1;
  let mouseovered: any = null;
  let highlightNode: any = null;
  let currentDepth = 0;
  let currentNode: any;
  let rootNode: any;
  let zooming = false;
  let full_repaint = true;

  onResize();

  function display(data: any, relayout?: boolean) {
    log("display", data);

    console.time("treemap");
    let nodes;
    if (!nnn || relayout) {
      nodes = treemap.nodes(data);
    }

    const total_size = data.value;
    nodes = walk(data, null, currentDepth + TREEMAP_LEVELS + 1);
    console.timeEnd("treemap");

    console.time("filter");
    nnn = nodes.filter(
      (d: any) =>
        d.depth >= currentDepth &&
        d.depth <= currentDepth + TREEMAP_LEVELS + 1 &&
        d.value / total_size > 0.000001,
    );
    console.timeEnd("filter");

    const enter = fake_svg.data(nnn);
    enter.forEach(rectDrawNoAnimate);

    xd.domain([data.x, data.x + data.dx]);
    yd.domain([data.y, data.y + data.dy]);

    fake_svg.objects.forEach(rectDrawAnimate);

    fake_svg.sort((a: any, b: any) => a.__data__.depth - b.__data__.depth);

    drawThenCancel();
  }

  function gx(d: any): number {
    return xd(d.x);
  }
  function gy(d: any): number {
    return yd(d.y);
  }
  function gw(d: any): number {
    return xd(d.x + d.dx) - xd(d.x);
  }
  function gh(d: any): number {
    return yd(d.y + d.dy) - yd(d.y);
  }

  function rectDrawAnimate(g: any) {
    rectDraw(g, true);
  }
  function rectDrawNoAnimate(g: any) {
    rectDraw(g, false);
  }

  function rectDraw(g: any, animate: boolean) {
    const d = g.__data__;

    let x = xd(d.x);
    let y = yd(d.y);
    let w = xd(d.x + d.dx) - xd(d.x);
    let h = yd(d.y + d.dy) - yd(d.y);

    const depthDiff = d.depth - currentDepth;
    const labelAdjustment = textHeight * 1.4;

    const chain = [d];
    const ry: number[] = [];
    for (let i = 0, n = d; i < depthDiff; i++) {
      const p = n.parent;
      if (!p) break;
      chain.push(p);
      ry.push(gy(n) - gy(p));
      n = p;
    }

    let p = chain.pop();
    if (p) {
      h = gh(p);
      const parentHeight = p.parent ? gh(p.parent) : height;
      let ny = (gy(p) / parentHeight) * (parentHeight - labelAdjustment);
      for (let i = chain.length; i--; ) {
        const n = chain[i];
        ny += (ry[i] / gh(p)) * (h - labelAdjustment);
        h = (gh(n) / gh(p)) * (h - labelAdjustment);
        p = n;
      }
      y = ny + labelAdjustment * depthDiff;
    }

    if (animate) {
      const now = Date.now();
      const end = now + 400;
      const trans: any = (g.__transition__ = {
        timeStart: now,
        timeEnd: end,
        ease: d3Merged.easeCubic,
        props: {},
      });
      transition(trans.props, "x", g, x);
      transition(trans.props, "y", g, y);
      transition(trans.props, "w", g, w);
      transition(trans.props, "h", g, h);
    } else {
      g.x = x;
      g.y = y;
      g.h = h;
      g.w = w;
    }
  }

  function transition(trans: any, prop: string, graphic: any, value: number) {
    if (prop in graphic) {
      trans[prop] = { valueStart: graphic[prop], valueEnd: value };
    } else {
      graphic[prop] = value;
    }
  }

  function draw(next: (t?: number) => void) {
    if (BENCH) console.time("canvas draw");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let dom = fake_svg.objects;

    const found: any[] = [];
    const hover: any[] = [];

    ctx.save();
    const dpr = window.devicePixelRatio;
    ctx.scale(dpr, dpr);

    let needSvgUpdate = false;

    // Update animation
    dom.forEach((g: any) => {
      const d = g.__data__;
      const trans = g.__transition__;
      if (trans) {
        const now = Date.now();
        const dur = trans.timeEnd - trans.timeStart;
        const lapse = now - trans.timeStart;
        const k = Math.min(lapse / dur, 1);
        const ease = trans.ease;

        const props = trans.props;
        for (const pk in props) {
          const prop = props[pk];
          const diff = prop.valueEnd - prop.valueStart;
          g[pk] = ease(k) * diff + prop.valueStart;
        }

        if (now >= trans.timeEnd) {
          delete g.__transition__;
          if (g.__remove__) {
            fake_svg.map.delete(fake_svg.keyFn(d));
            needSvgUpdate = true;
          }
        }
      }
    });

    if (needSvgUpdate) {
      fake_svg.updateObjects();
      fake_svg.sort();
      dom = fake_svg.objects;
    }

    dom.forEach((g: any) => {
      const data = g.__data__;
      if (data.depth < currentDepth) return;

      const l = data.parent === mouseovered ? 1 : 0;
      if (data.depth > TREEMAP_LEVELS + currentDepth + l) return;

      ctx.save();

      const x = g.x;
      const y = g.y;
      const w = g.w;
      const h = g.h;

      if (mouseovered || highlightNode) ctx.globalAlpha = 0.4;
      else ctx.globalAlpha = 0.95;

      if (w < 0.5 || h < 0.5) {
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fillStyle = fill(data);

      let inHighlight = false;
      if (highlightNode) {
        let p = data;
        while (p.depth > highlightNode.depth) p = p.parent;
        inHighlight = p === highlightNode;
      }

      const inRect = isPointInRect(mousex, mousey, x, y, w, h);

      if (inHighlight) {
        ctx.globalAlpha = 1;
      } else if (inRect) {
        ctx.globalAlpha = data === mouseovered ? 1 : 0.5;
      }

      if (inRect) {
        if (data.depth <= currentDepth + TREEMAP_LEVELS) {
          hover.push(data);
        }
        if (mouseclicked) found.push(data);
      }

      ctx.fill();

      if (USE_BORDERS) {
        ctx.strokeStyle = "#eee";
        ctx.stroke();
      }

      if (w > 70) {
        ctx.clip();
        ctx.fillStyle = "#333";
        ctx.fillText(data.name + " " + format(data.value), x + 3, y);
      }

      ctx.restore();
    });

    ctx.restore();

    if (BENCH) console.timeEnd("canvas draw");
    if (hover.length) mouseovered = hover[hover.length - 1];
    if (mouseovered) {
      State.highlightPath(keys(mouseovered));
    }
    mouseclicked = false;

    if (found.length) {
      const d = found[hover.length - 1];
      const to = d.children ? d : d.parent;
      State.navigateTo(keys(to));
    }

    full_repaint = false;
    next(100);
  }

  // Canvas mouse events
  d3Merged
    .select(canvas)
    .on("mousemove", function () {
      [mousex, mousey] = d3Merged.mouse(canvas);
      drawThenCancel();
    })
    .on("mouseout", function () {
      mouseovered = null;
      State.highlightPath(null);
      mousex = -1;
      mousey = -1;
    })
    .on("click", function () {
      mouseclicked = true;
      drawThenCancel();
    });

  function navigateTo(d: any) {
    if (!d || !d.children) return;
    full_repaint = true;
    currentDepth = d.depth;
    currentNode = d;
    highlightNode = null;
    zoomTo(d);
  }

  function walk(node: any, a: any[] | null, maxDepth: number): any[] {
    a = a ? a : [node];
    if (node.depth < maxDepth && node.children) {
      for (let i = 0, len = node.children.length; i < len; i++) {
        a.push(node.children[i]);
        walk(node.children[i], a, maxDepth);
      }
    }
    return a;
  }

  function zoomTo(d: any) {
    if (zooming || !d) return;
    zooming = true;
    display(d);
    zooming = false;
  }

  function generateTreemap(data: any) {
    rootNode = data;
    log("generateTreemap", rootNode);

    let oldPath: string[] | undefined;
    if (currentNode) oldPath = keys(currentNode);

    colorByTypes(rootNode);

    currentNode = rootNode;
    currentDepth = 0;
    display(rootNode, true);

    if (oldPath) navigateToPath(oldPath);
  }

  function navigateToPath(pathKeys: string[]) {
    const n = getNodeFromPath(pathKeys, rootNode);
    if (n) navigateTo(n);
  }

  function showMore() {
    TREEMAP_LEVELS++;
    zoomTo(currentNode);
  }

  function showLess() {
    if (TREEMAP_LEVELS > 1) TREEMAP_LEVELS--;
    zoomTo(currentNode);
  }

  return {
    generate: generateTreemap,
    showLess,
    showMore,
    resize: onResize,
    cleanup() {
      rootNode = null;
      currentNode = null;
    },
    navigateTo: navigateToPath,
    highlightPath(_path: string[] | null | undefined, node?: any) {
      highlightNode = node;
      drawThenCancel();
    },
  };
}

// =============================================================================
// FLAMEGRAPH (from app/js/flamegraph.js)
// =============================================================================

function getFlameNodePath(node: any): string[] {
  const fullname: string[] = [];
  while (node.parent) {
    fullname.push(node.data.name);
    node = node.parent;
  }
  fullname.push(node.data.name);
  return fullname.reverse();
}

class FlameGraph extends Chart {
  chart: any;
  graph: any;
  data: any = null;
  currentPath: string = "";

  constructor() {
    super();
    this.chart = d3Merged.select("#flame-chart");

    this.graph = flamegraph()
      .height(400)
      .width(460)
      .cellHeight(20)
      .transitionDuration(350)
      .transitionEase(d3Merged.easeCubic);

    const tip = defaultFlamegraphTooltip().text((d: any) => {
      const fullpath = getFlameNodePath(d).join("/");
      return (
        fullpath +
        " - " +
        format(d.data.value) +
        " " +
        `(${((d.data.value / this.data.value) * 100).toFixed(2)}%)`
      );
    });

    this.graph.tooltip(tip).onClick((e: any) => {
      if (e) {
        const movingTo = getFlameNodePath(e).join("/");
        const route = Navigation.currentPath().join("/");
        if (route !== movingTo) {
          console.log("movingTo", movingTo, route);
        }
        this.currentPath = movingTo;
        State.navigateTo(getFlameNodePath(e));
      }
    });
  }

  resize() {
    const w = globalWidth || window.innerWidth;
    const h = globalHeight || window.innerHeight - 200;
    const newHeight = (h * 2) / 3;
    this.graph.width(w).height(newHeight);
    const svg = document.querySelector(".d3-flame-graph");
    if (svg) {
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(newHeight));
    }
    this.draw();
  }

  draw() {
    if (!this.data) return;
    this.chart.datum(this.data).call(this.graph);
  }

  navigateTo(path: string[]) {
    if (path.join("/") === this.currentPath) return;
  }

  generate(data: any) {
    console.log("FlameGraph generate");

    function computeValue(node: any): number {
      if (node.children && node.children.length > 0) {
        let sum = 0;
        for (const child of node.children) {
          sum += computeValue(child);
        }
        node.value = sum;
        return sum;
      } else {
        node.value = node.size || 0;
        return node.value;
      }
    }

    const clonedData = JSON.parse(JSON.stringify(data));
    computeValue(clonedData);

    const THRESHOLD = 0.001;
    const totalValue = clonedData.value || 1;

    function filterSmallNodes(node: any): any {
      if (node.children) {
        node.children = node.children
          .filter((child: any) => child.value / totalValue >= THRESHOLD)
          .map(filterSmallNodes);
      }
      return node;
    }

    filterSmallNodes(clonedData);
    this.data = clonedData;
    this.draw();
  }

  cleanup() {
    this.chart.selectAll("*").remove();
  }
}

// =============================================================================
// LISTVIEW (from app/js/listview.js)
// =============================================================================

function elm(
  tag: string,
  attrs?: Record<string, string>,
  children?: string | HTMLElement | (string | HTMLElement)[],
  props?: Record<string, any>,
): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      el.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    const childArr = Array.isArray(children) ? children : [children];
    for (let child of childArr) {
      if (typeof child === "string") {
        (child as any) = document.createTextNode(child);
      }
      el.appendChild(child as Node);
    }
  }
  if (props) {
    for (const k in props) {
      (el as any)[k] = props[k];
    }
  }
  return el;
}

const sidebar = document.getElementById("sidebar")!;

class ListView extends Chart {
  path: string[] | null = null;
  current: any = null;
  nodes: any[] = [];
  highlightedPath: string[] | null = null;

  navigateTo(path: string[], current: any) {
    this.path = path;
    this.current = current;

    const nodes = current._children || current.children || [];
    this.nodes = nodes.slice().sort((a: any, b: any) => {
      const aVal = a.sum ?? a.value ?? a.size ?? 0;
      const bVal = b.sum ?? b.value ?? b.size ?? 0;
      if (aVal < bVal) return 1;
      if (aVal > bVal) return -1;
      return 0;
    });

    this.draw(this.path!, this.current);
  }

  draw(path: string[], current: any) {
    if (!current) return;

    const INITIAL_LOAD = 10;
    const currentSize = current.sum ?? current.value ?? current.size ?? 0;

    const navs: HTMLElement[] = [
      elm(
        "h5",
        { class: "nav-group-title" },
        `${path.join("/")} ${format(currentSize)}`,
        {
          onclick: () => State.navigateTo(path.slice(0, -1)),
        },
      ),
    ];

    const highlighted = this.highlightedPath;
    const check_path =
      highlighted &&
      highlighted.length > path.length &&
      !path.some((p, i) => p !== highlighted[i])
        ? highlighted[path.length]
        : null;

    const nodes = this.nodes;
    nodes.slice(0, INITIAL_LOAD).forEach((child: any) => {
      const childSize = child.sum ?? child.value ?? child.size ?? 0;
      navs.push(
        elm(
          "span",
          {
            class: `nav-group-item${check_path === child.name ? " active" : ""}`,
            href: "#",
          },
          [
            elm("span", {
              class: "icon icon-record",
              style: `color: ${fill(child)};`,
            }),
            child.name || "",
            elm(
              "span",
              { class: "", style: "float:right;" },
              format(childSize),
            ),
          ],
          {
            onmousedown: () => {
              child.children && State.navigateTo([...path, child.name]);
            },
            onmouseenter: () => State.highlightPath([...path, child.name]),
            onmouseleave: () => State.highlightPath(),
          },
        ),
      );
    });

    const remaining = nodes.length - INITIAL_LOAD;
    if (remaining > 0) {
      navs.push(
        elm("span", { class: "nav-group-item", href: "#" }, [
          elm("span", { class: "icon icon-record" }),
          `and ${remaining} other items....`,
        ]),
      );
    }

    [...sidebar.childNodes].forEach((v) => v.remove());
    const nav = elm("nav", { class: "nav-group" }, navs);
    sidebar.appendChild(nav);
  }

  highlightPath(path?: string[] | null) {
    const oldHighlight = this.highlightedPath;
    this.highlightedPath = path || null;

    if (!this.path || !this.current) return;

    const highlighted = path;
    const check_path =
      highlighted &&
      highlighted.length > this.path.length &&
      !this.path.some((p, i) => p !== highlighted![i])
        ? highlighted[this.path.length]
        : null;

    const oldCheck =
      oldHighlight &&
      oldHighlight.length > this.path.length &&
      !this.path.some((p, i) => p !== oldHighlight[i])
        ? oldHighlight[this.path.length]
        : null;

    if (check_path !== oldCheck) {
      const items = sidebar.querySelectorAll(".nav-group-item");
      items.forEach((item) => {
        const itemName = item.childNodes[1];
        if (itemName && itemName.textContent === check_path) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    }
  }

  cleanup() {
    this.path = null;
    this.current = null;
    this.highlightedPath = null;
  }
}

// =============================================================================
// BREADCRUMBS (from app/js/breadcrumbs.js)
// =============================================================================

let selection: any = null;

function updateSelection(s: any) {
  selection = s;
}

function getAncestors(node: any): any[] {
  if (!node) return [];
  let path: any[] = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }

  const root = current;

  if (root.name === "/" || root.name.indexOf("/") === -1) {
    path.unshift(root);
  } else {
    path = root.name
      .split(PATH_DELIMITER)
      .slice(1)
      .map((d: string) => ({ name: d, depth: -1, root: true }))
      .concat(path);
  }

  return path;
}

function _updateBreadcrumbs(nodeArray: any[]) {
  const g = d3Merged
    .select("#bottom_status")
    .selectAll("span")
    .data(nodeArray, (d: any) => d.name + d.depth);

  const entering = g
    .enter()
    .append("span")
    .style("-webkit-app-region", "no-drag")
    .style("cursor", "pointer")
    .on("click", (d: any) => {
      log("navigate", d);
      State.navigateTo(keys(d));
    });

  entering.text((d: any) => (nodeArray[0] === d ? "" : " > ") + d.name);

  g.exit().remove();
}

class Breadcrumbs extends Chart {
  trail: any[] = [];

  navigateTo(_path: string[], d: any) {
    if (!d) return;
    this.trail = getAncestors(d);
    _updateBreadcrumbs(this.trail);
  }

  highlightPath(_path?: string[] | null, d?: any) {
    if (d) {
      _updateBreadcrumbs(getAncestors(d));
      updateSelection(d);
    } else {
      _updateBreadcrumbs(this.trail);
      updateSelection(null);
    }
  }
}

// Context menu via RPC (replaces Electron remote.Menu)
window.addEventListener(
  "contextmenu",
  async (e) => {
    if (!selection) return;
    e.preventDefault();

    const items = [
      { label: "Open Directory", action: "show-selection", enabled: true },
      {
        label: "Open File",
        action: "open-selection",
        enabled: !selection.children,
      },
      { label: "Delete", action: "trash-selection", enabled: true },
    ];

    try {
      await electroview.rpc.request.showContextMenu({ items });
    } catch (err) {
      console.error("[renderer] Context menu error:", err);
    }
  },
  false,
);

// =============================================================================
// ROUTER (from app/js/router.js)
// =============================================================================

// Simple EventEmitter for NavigationController
type EventHandler = (...args: any[]) => void;

class SimpleEventEmitter {
  private _handlers: Record<string, EventHandler[]> = {};

  on(event: string, handler: EventHandler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  emit(event: string, ...args: any[]) {
    const handlers = this._handlers[event];
    if (handlers) handlers.forEach((h) => h(...args));
  }
}

class NavigationController extends SimpleEventEmitter {
  backStack: string[][] = [];
  fwdStack: string[][] = [];

  constructor() {
    super();
    this.clear();
  }

  clear() {
    this.backStack = [];
    this.fwdStack = [];
  }

  currentPath(): string[] {
    const { backStack } = this;
    return backStack.length ? backStack[backStack.length - 1].concat() : [];
  }

  updatePath(path: string[]) {
    if (!path.length) return;
    if (this.currentPath().join("/") === path.join("/")) return;
    this.backStack.push(path);
    if (this.fwdStack.length) this.fwdStack = [];
    this.notify();
  }

  notify() {
    this.emit("navigationchanged", this.currentPath());
  }

  back() {
    if (this.backStack.length < 2) return;
    const n = this.backStack.pop()!;
    log("navigateBack", n);
    this.fwdStack.push(n);
    this.notify();
  }

  forward() {
    if (!this.fwdStack.length) return;
    const n = this.fwdStack.pop()!;
    this.backStack.push(n);
    this.notify();
  }
}

const Navigation = new NavigationController();

const State = {
  navigateTo: (path: string[]) => Navigation.updatePath(path),
  clearNavigation: () => {
    Navigation.clear();
    PluginManager.clear();
  },
  highlightPath: (path?: string[] | null) => {
    PluginManager.highlightPath(path);
  },
  showWorking: (func: (done: () => void) => void) => {
    lightbox(true);
    setTimeout(func, 100, () => lightbox(false));
  },
};

// Global width/height (used by FlameGraph and others)
let globalWidth: number;
let globalHeight: number;

function calculateDimensions() {
  globalWidth = innerWidth;
  globalHeight =
    innerHeight -
    (document.querySelector("header")?.getBoundingClientRect().height || 0) -
    (document.querySelector("footer")?.getBoundingClientRect().height || 0);
}

// =============================================================================
// PLUGIN MANAGER (from app/js/router.js)
// =============================================================================

class SpacePluginManager {
  activatedGraphs = new Set<any>();
  data: any = null;

  resize() {
    calculateDimensions();
    this.activatedGraphs.forEach((g) => g.resize());
  }

  clear() {
    this.data = null;
  }

  generate(json: any) {
    const loaded = this.data;
    this.data = json;

    this.activatedGraphs.forEach((g) => g.generate(json));
    this.resize();
    if (!loaded) {
      State.navigateTo([json.name]);
    } else {
      this.navigateTo(Navigation.currentPath());
    }
  }

  navigateTo(path: string[]) {
    if (!this.data) return;
    const current = getNodeFromPath(path, this.data);
    this.activatedGraphs.forEach((g) => g.navigateTo(path, current, this.data));
  }

  highlightPath(path?: string[] | null) {
    const current =
      path && path.length ? getNodeFromPath(path, this.data) : null;
    this.activatedGraphs.forEach((g) => {
      if (g.highlightPath) g.highlightPath(path, current, this.data);
    });
  }

  navigateUp() {
    const current = Navigation.currentPath();
    if (current.length > 1) {
      current.pop();
      State.navigateTo(current);
    }
  }

  showLess() {
    this.activatedGraphs.forEach((g) => g.showLess());
  }

  showMore() {
    this.activatedGraphs.forEach((g) => g.showMore());
  }

  cleanup() {
    this.activatedGraphs.forEach((g) => g.cleanup());
  }

  activate(graph: any) {
    this.activatedGraphs.add(graph);
    if (this.data) {
      this.data = _loadLast();
      this.generate(this.data);
    }
  }

  loadLast() {
    const data = _loadLast();
    if (data) this.generate(data);
  }

  deactivate(graph: any) {
    graph.cleanup();
    this.activatedGraphs.delete(graph);
  }

  deactivateAll() {
    this.activatedGraphs.forEach((g) => this.deactivate(g));
  }
}

const PluginManager = new SpacePluginManager();

Navigation.on("navigationchanged", (path: string[]) => {
  PluginManager.navigateTo(path);
});

// =============================================================================
// Chart instances
// =============================================================================

const treemapGraph = TreeMap();
const sunburstGraph = SunBurst();
const flamegraphGraph = new FlameGraph();
const listview = new ListView();
const breadcrumbs = new Breadcrumbs();

calculateDimensions();

PluginManager.activate(listview);
PluginManager.activate(breadcrumbs);

// =============================================================================
// RADAR (main app controller from app/js/radar.js)
// =============================================================================

let isScanning = false;
let isPaused = false;
let current_size = 0;
let start_time = 0;

let currentDiskInfo: {
  total: number;
  used: number;
  available: number;
  usePercent: number;
} | null = null;

const legend = d3Merged.select("#legend");
const bottomStatus = document.getElementById("bottom_status")!;

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updateStatsDisplay(
  fileCount: number,
  dirCount: number,
  size: number,
  errorCount: number,
) {
  const elapsed = (performance.now() - start_time) / 1000;
  const totalItems = fileCount + dirCount;
  const itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
  const bytesPerSec = elapsed > 0 ? size / elapsed : 0;

  let statusText = `Scanning: ${formatNumber(fileCount)} files | ${formatNumber(dirCount)} dirs | ${format(size)} | ${formatNumber(itemsPerSec)} items/sec | ${format(bytesPerSec)}/sec`;

  if (errorCount && errorCount > 0) {
    statusText += ` | ${formatNumber(errorCount)} errors`;
  }

  bottomStatus.textContent = statusText;
}

function lightbox(show: boolean) {
  const loading = document.getElementById("loading")!;
  const shades = document.getElementById("shades")!;
  const promptbox = document.getElementById("promptbox")!;

  loading.style.display = show ? "block" : "none";
  shades.style.display = show ? "flex" : "none";
  promptbox.style.display = show ? "none" : "";
  shades.style.opacity = show ? "0.8" : "1";
}

function showPrompt() {
  const shades = document.getElementById("shades")!;
  const dir_opener = document.getElementById("dir_opener")!;
  shades.style.display = "flex";
  dir_opener.style.display = "none";
}

function hidePrompt() {
  const shades = document.getElementById("shades")!;
  const dir_opener = document.getElementById("dir_opener")!;
  shades.style.display = "none";
  dir_opener.style.display = "inline-block";
}

function updateScanButtons() {
  const cancelBtn = document.getElementById("cancel_scan_btn");
  const pauseBtn = document.getElementById("pause_scan_btn");

  if (cancelBtn) {
    cancelBtn.style.display = isScanning ? "inline-block" : "none";
  }
  if (pauseBtn) {
    pauseBtn.style.display = isScanning ? "inline-block" : "none";
    if (isScanning) {
      pauseBtn.textContent = isPaused ? "Resume Scan" : "Pause Scan";
      pauseBtn.className = isPaused
        ? "btn btn-positive pull-right"
        : "btn btn-default pull-right";
      pauseBtn.onclick = isPaused ? resumeScan : pauseScan;
    }
  }
}

async function startScan(scanPath: string) {
  cleanup();
  hidePrompt();
  State.clearNavigation();
  legend.style("display", "block");
  log("start", scanPath);
  start_time = performance.now();
  console.time("scan_job_time");
  isScanning = true;
  isPaused = false;
  updateScanButtons();

  // Get disk info via RPC
  currentDiskInfo = null;
  try {
    const diskInfo = await electroview.rpc.request.getDiskInfo({
      path: scanPath,
    });
    if (diskInfo) {
      currentDiskInfo = diskInfo;
      const diskSpaceElement = document.getElementById("disk_space_info");
      if (diskSpaceElement) {
        const usePercent =
          diskInfo.usePercent != null ? diskInfo.usePercent.toFixed(2) : "0.00";
        diskSpaceElement.textContent = `Total: ${format(diskInfo.total)} | Free: ${format(diskInfo.available)} | Used: ${format(diskInfo.used)} (${usePercent}%)`;
      }
    }
  } catch (err) {
    console.warn("[renderer] Could not get disk info:", err);
  }

  // Send scan request via RPC
  try {
    const result = await electroview.rpc.request.scanDirectory({
      path: scanPath,
    });
    if (!result.started) {
      console.error("[renderer] Scan failed to start:", result.error);
      isScanning = false;
      updateScanButtons();
    }
  } catch (err) {
    console.error("[renderer] Scan request error:", err);
    isScanning = false;
    updateScanButtons();
  }
}

function progress(
  dir: string,
  name: string,
  size: number,
  fileCount: number,
  dirCount: number,
  errorCount: number,
) {
  const pauseBtn = isPaused
    ? "<button class='btn btn-positive' id='legend-resume-btn' style='margin-top: 10px; margin-right: 5px;'>Resume Scan</button>"
    : "<button class='btn btn-default' id='legend-pause-btn' style='margin-top: 10px; margin-right: 5px;'>Pause Scan</button>";
  const statusText = isPaused ? "PAUSED" : "Scanning...";

  legend.html(
    "<h2>" +
      statusText +
      " <i>(try grabbing a drink..)</i></h2>" +
      "<p style='font-size: 0.8em; word-break: break-all; max-height: 60px; overflow: hidden;'>" +
      dir +
      "</p>" +
      "<br/>Scanned: " +
      format(size) +
      (errorCount > 0
        ? " <span style='color: #c44;'>(" + errorCount + " errors)</span>"
        : "") +
      "<br/><br/>" +
      pauseBtn +
      "<button class='btn btn-negative' id='legend-cancel-btn' style='margin-top: 10px;'>Cancel Scan</button>",
  );

  // Wire up legend buttons
  const legendPauseBtn = document.getElementById("legend-pause-btn");
  const legendResumeBtn = document.getElementById("legend-resume-btn");
  const legendCancelBtn = document.getElementById("legend-cancel-btn");

  if (legendPauseBtn) legendPauseBtn.onclick = pauseScan;
  if (legendResumeBtn) legendResumeBtn.onclick = resumeScan;
  if (legendCancelBtn) legendCancelBtn.onclick = cancelScan;

  current_size = size;

  if (fileCount !== undefined && dirCount !== undefined) {
    updateStatsDisplay(fileCount, dirCount, size, errorCount);
  }
}

function refresh(json: any) {
  log("refresh..");
  lightbox(true);
  legend.html("Generating preview...");

  setTimeout(() => {
    onJson(json);
    lightbox(false);
  }, 1000);
}

function cleanup() {
  lightbox(true);
  PluginManager.cleanup();
}

function complete(json: any, finalStats?: any) {
  log("complete..", json);
  console.timeEnd("scan_job_time");
  isScanning = false;
  isPaused = false;
  updateScanButtons();

  console.time("a");
  onJson(json);
  legend.style("display", "none");
  lightbox(false);
  requestAnimationFrame(() => console.timeEnd("a"));

  const time_took = performance.now() - start_time;
  log("Time took", (time_took / 60 / 1000).toFixed(2), "mins");

  const wasCancelled = finalStats && finalStats.cancelled;

  if (finalStats) {
    const elapsed = time_took / 1000;
    const totalItems = finalStats.fileCount + finalStats.dirCount;
    const itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
    const bytesPerSec = elapsed > 0 ? finalStats.current_size / elapsed : 0;
    const timeStr =
      elapsed < 60 ? elapsed.toFixed(1) + "s" : (elapsed / 60).toFixed(1) + "m";

    let statusText = wasCancelled ? "CANCELLED: " : "Scanned: ";
    statusText += `${formatNumber(finalStats.fileCount)} files | ${formatNumber(finalStats.dirCount)} dirs | ${format(finalStats.current_size)} in ${timeStr} (${formatNumber(itemsPerSec)} items/sec, ${format(bytesPerSec)}/sec)`;

    if (finalStats.errorCount && finalStats.errorCount > 0) {
      statusText += ` | ${formatNumber(finalStats.errorCount)} errors (permission denied, etc.)`;
    }

    bottomStatus.textContent = statusText;
  }
}

async function cancelScan() {
  if (!isScanning) return;
  console.log("[renderer] Cancelling scan...");
  isPaused = false;
  legend.html(
    "<h2>Cancelling scan...</h2><p>Please wait while the scan stops...</p>",
  );
  try {
    await electroview.rpc.request.cancelScan({});
  } catch (err) {
    console.error("[renderer] Cancel error:", err);
  }
}

async function pauseScan() {
  if (!isScanning || isPaused) return;
  console.log("[renderer] Pausing scan...");
  isPaused = true;
  updateScanButtons();
  try {
    await electroview.rpc.request.pauseScan({});
  } catch (err) {
    console.error("[renderer] Pause error:", err);
  }
}

async function resumeScan() {
  if (!isScanning || !isPaused) return;
  console.log("[renderer] Resuming scan...");
  isPaused = false;
  updateScanButtons();
  try {
    await electroview.rpc.request.resumeScan({});
  } catch (err) {
    console.error("[renderer] Resume error:", err);
  }
}

function onJson(data: any) {
  // Add free space as a child of root if disk info is available
  if (currentDiskInfo && currentDiskInfo.available > 0) {
    if (!data.children) data.children = [];
    data.children = data.children.filter((c: any) => !c._isFreeSpace);
    data.children.push({
      name: "Free Space",
      size: currentDiskInfo.available,
      _isFreeSpace: true,
    });
    console.log("Added free space:", format(currentDiskInfo.available));
  }

  // Save data via RPC (replaces fs.writeFileSync + zlib)
  const jsonStr = JSON.stringify(data);
  electroview.rpc.request.saveScanData({ data: jsonStr }).catch((err: any) => {
    console.warn("[renderer] Failed to save scan data:", err);
  });

  PluginManager.generate(data);
}

/**
 * Fetch a depth-limited subtree from SQLite and replace the current view.
 * Used for drill-down into truncated directories and navigate-up past root.
 */
async function fetchAndDisplaySubtree(nodeId: number) {
  lightbox(true);
  try {
    const treeJson = await electroview.rpc.request.getSubtree({
      nodeId,
      depth: LAZY_LOAD_DEPTH,
    });
    if (treeJson) {
      currentViewRootId = nodeId;
      const tree = JSON.parse(treeJson);
      Navigation.clear();
      PluginManager.clear();
      PluginManager.generate(tree);
      lightbox(false);
    } else {
      lightbox(false);
    }
  } catch (err) {
    console.error("[renderer] fetchAndDisplaySubtree error:", err);
    lightbox(false);
  }
}

function _loadLast(): any {
  // This is synchronous in the original but must be async with RPC.
  // For the plugin manager's loadLast, we use an async wrapper.
  // For the synchronous call in activate(), return cached data.
  return PluginManager.data;
}

// Async version of loadLast for initial load
async function loadLastAsync(): Promise<any> {
  try {
    const json = await electroview.rpc.request.loadLastScan({});
    if (json) {
      return JSON.parse(json);
    }
  } catch (err) {
    console.warn("[renderer] Failed to load last scan:", err);
  }
  return null;
}

// Override PluginManager.loadLast to be async-aware
const originalLoadLast = PluginManager.loadLast.bind(PluginManager);
PluginManager.loadLast = function () {
  loadLastAsync().then((data) => {
    if (data) PluginManager.generate(data);
  });
};

// Override navigateTo to handle lazy loading of truncated directories.
// A truncated dir has _nodeId, empty _children, and nonzero size — it exists
// in the SQLite DB but wasn't expanded in the current partial tree.
const _originalPluginNavigateTo = PluginManager.navigateTo.bind(PluginManager);
PluginManager.navigateTo = function (path: string[]) {
  if (!this.data) return;
  const current = getNodeFromPath(path, this.data);

  if (
    current &&
    current._nodeId &&
    current !== this.data &&
    (!current._children || current._children.length === 0) &&
    (current.sum > 0 || current.value > 0 || current.size > 0)
  ) {
    fetchAndDisplaySubtree(current._nodeId);
    return;
  }

  _originalPluginNavigateTo(path);
};

// Override navigateUp to handle navigation past the current view root.
PluginManager.navigateUp = function () {
  const current = Navigation.currentPath();
  if (current.length > 1) {
    current.pop();
    State.navigateTo(current);
  } else if (this.data && this.data._parentNodeId) {
    fetchAndDisplaySubtree(this.data._parentNodeId);
  }
};

// =============================================================================
// VIEW SWITCHING
// =============================================================================

function hideAll() {
  [...document.querySelectorAll(".mode_buttons")].forEach((button) =>
    button.classList.remove("active"),
  );
  [...document.querySelectorAll(".graph-container")].forEach(
    (el) => ((el as HTMLElement).style.display = "none"),
  );
}

function deactivateCharts() {
  [sunburstGraph, treemapGraph, flamegraphGraph].forEach((chart) =>
    PluginManager.deactivate(chart),
  );
}

function showSunburst() {
  hideAll();
  document.getElementById("sunburst_button")!.classList.add("active");
  d3Merged.select("#sunburst-canvas").style("display", "inline-block");
  d3Merged.select("#sunburst-chart").style("display", "inline-block");
  deactivateCharts();
  PluginManager.activate(sunburstGraph);
}

function showTreemap() {
  hideAll();
  document.getElementById("treemap_button")!.classList.add("active");
  d3Merged.select("canvas").style("display", "inline-block");
  deactivateCharts();
  PluginManager.activate(treemapGraph);
}

function showFlamegraph() {
  hideAll();
  document.getElementById("flamegraph_button")!.classList.add("active");
  document.getElementById("flame-chart")!.style.display = "inline-block";
  deactivateCharts();
  PluginManager.activate(flamegraphGraph);
}

// =============================================================================
// Actions that use RPC
// =============================================================================

async function scanFolder() {
  try {
    console.log("[renderer] scanFolder invoked");
    const selectedPath = await electroview.rpc.request.selectFolder({});
    if (selectedPath) {
      startScan(selectedPath);
    } else {
      console.log("[renderer] Folder selection canceled");
    }
  } catch (err) {
    console.error("[renderer] scanFolder error:", err);
  }
}

function scanRoot() {
  const ok = confirm("This may take some time, continue?");
  if (ok) {
    startScan("/");
  }
}

async function newWindow() {
  log("new window");
  try {
    await electroview.rpc.request.openNewWindow({});
  } catch (err) {
    console.error("[renderer] newWindow error:", err);
  }
}

function readFile() {
  // In Electrobun, we use the folder picker to select a file
  // (or could add a file picker RPC in the future)
  scanFolder();
}

async function scanMemory() {
  try {
    const result = await electroview.rpc.request.scanMemory({});
    if (result) {
      const data = JSON.parse(result);
      hidePrompt();
      onJson(data);
    }
  } catch (err) {
    console.error("[renderer] scanMemory error:", err);
  }
}

async function openDirectory() {
  const loc = Navigation.currentPath();
  if (loc && loc.length) {
    try {
      await electroview.rpc.request.showItemInFolder({ path: loc.join("/") });
    } catch (err) {
      console.error("[renderer] openDirectory error:", err);
    }
  }
}

async function openSelection() {
  if (selection && !selection.children) {
    const file = key(selection);
    log("open selection", file);
    try {
      await electroview.rpc.request.showItemInFolder({ path: file });
    } catch (err) {
      console.error("[renderer] openSelection error:", err);
    }
  }
}

async function showSelection() {
  if (selection) {
    const file = key(selection);
    log("show selection", file);
    try {
      await electroview.rpc.request.showItemInFolder({ path: file });
    } catch (err) {
      console.error("[renderer] showSelection error:", err);
    }
  }
}

async function trashSelection() {
  if (selection) {
    const file = key(selection);
    const ok = confirm(
      "Are you sure you wish to send " + file + " to the trash?",
    );
    if (ok) {
      log("trash selection", file);
      try {
        const moved = await electroview.rpc.request.moveToTrash({ path: file });
        if (moved) {
          alert(
            file +
              " moved to trash!\n(currently needs rescan to update graphs)",
          );
        }
      } catch (err) {
        console.error("[renderer] trashSelection error:", err);
      }
    }
  }
}

// =============================================================================
// Drag and Drop
// =============================================================================

document.ondragover = document.ondrop = (e) => {
  e.preventDefault();
  return false;
};

const promptbox = document.getElementById("promptbox")!;
promptbox.ondragover = function () {
  this.className = "hover";
  return false;
};
promptbox.ondragleave = promptbox.ondragend = function () {
  this.className = "";
  return false;
};
promptbox.ondrop = function (e) {
  this.className = "";
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) {
    // In WebView, file.path may not be available. Use file.name as fallback.
    const filePath = (file as any).path || file.name;
    if (filePath) startScan(filePath);
  }
};

// =============================================================================
// WINDOW RESIZE
// =============================================================================

d3Merged.select(window).on("resize", () => {
  PluginManager.resize();
});

// =============================================================================
// BUTTON WIRING (replaces inline onclick handlers)
// =============================================================================

function wireButton(id: string, handler: () => void) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

// Prevent toolbar button clicks from triggering window drag
// (Electrobun's drag region handler is on document.mousedown and uses
//  target.closest() which would match .toolbar-header on any child click)
// Only block on actual interactive elements so empty toolbar space stays draggable.
document
  .querySelectorAll(
    ".toolbar-header button, .toolbar-header input, .toolbar-header select, .toolbar-header a, .toolbar-header .btn-group",
  )
  .forEach((el) => {
    el.addEventListener("mousedown", (e) => e.stopPropagation());
  });

// Toolbar buttons
wireButton("btn-new-window", newWindow);
wireButton("btn-scan-root", scanRoot);
wireButton("btn-scan-folder", scanFolder);
wireButton("btn-read-file", readFile);
wireButton("btn-scan-memory", scanMemory);
wireButton("btn-show-less", () => PluginManager.showLess());
wireButton("btn-show-more", () => PluginManager.showMore());
wireButton("btn-navigate-up", () => PluginManager.navigateUp());

// Mode buttons
wireButton("sunburst_button", showSunburst);
wireButton("flamegraph_button", showFlamegraph);
wireButton("treemap_button", showTreemap);

// Footer buttons
wireButton("btn-nav-back", () => Navigation.back());
wireButton("btn-nav-forward", () => Navigation.forward());
wireButton("dir_opener", openDirectory);
wireButton("cancel_scan_btn", cancelScan);
wireButton("pause_scan_btn", pauseScan);

// Prompt buttons
wireButton("prompt-scan-root", scanRoot);
wireButton("prompt-scan-folder", scanFolder);
wireButton("prompt-read-file", readFile);
wireButton("prompt-scan-memory", scanMemory);
wireButton("prompt-load-last", () => {
  hidePrompt();
  State.clearNavigation();
  PluginManager.loadLast();
});

// =============================================================================
// STARTUP
// =============================================================================

function ready() {
  showPrompt();
  showSunburst();

  // Auto-open folder picker on startup
  try {
    console.log("[renderer] auto-opening folder picker on startup");
    scanFolder();
  } catch (e) {
    console.error("[renderer] auto-open picker failed", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ready);
} else {
  ready();
}

// =============================================================================
// Expose key functions on window for debugging / interop
// =============================================================================

(window as any).scanRoot = scanRoot;
(window as any).scanFolder = scanFolder;
(window as any).readFile = readFile;
(window as any).scanMemory = scanMemory;
(window as any).newWindow = newWindow;
(window as any).showSunburst = showSunburst;
(window as any).showTreemap = showTreemap;
(window as any).showFlamegraph = showFlamegraph;
(window as any).openDirectory = openDirectory;
(window as any).cancelScan = cancelScan;
(window as any).pauseScan = pauseScan;
(window as any).resumeScan = resumeScan;
(window as any).hidePrompt = hidePrompt;
(window as any).showPrompt = showPrompt;
(window as any).Navigation = Navigation;
(window as any).State = State;
(window as any).PluginManager = PluginManager;
(window as any).format = format;
(window as any).log = log;
