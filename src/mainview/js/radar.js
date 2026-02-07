"use strict";

// SpaceRadar - Browser-compatible version for Electrobun
// All Node.js APIs are accessed via RPC to the Bun main process

var PATH_DELIMITER = '/';

// Track scanning state
var isScanning = false;
var isPaused = false;

// RPC helper - get the Electrobun RPC instance
function getRPC() {
  return window._electrobunRPC;
}

// IPC handling via Electrobun RPC
function sendIpcMsg(cmd, msg) {
  try {
    var rpc = getRPC();
    if (!rpc) {
      console.error("[renderer] RPC not available");
      return;
    }
    if (cmd === "go") {
      console.log("[renderer] sending startScan", msg);
      rpc.request.startScan({ targetPath: msg });
    } else if (cmd === "cancel") {
      console.log("[renderer] sending cancelScan");
      rpc.request.cancelScan();
    } else if (cmd === "pause") {
      console.log("[renderer] sending pauseScan");
      rpc.request.pauseScan();
    } else if (cmd === "resume") {
      console.log("[renderer] sending resumeScan");
      rpc.request.resumeScan();
    }
  } catch (err) {
    console.error("[renderer] sendIpcMsg error", err);
  }
}

var current_size = 0,
  start_time,
  lastStatsUpdate = 0;

var legend = d3.select("#legend");
var bottomStatus = document.getElementById("bottom_status");

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update stats display in footer
function updateStatsDisplay(fileCount, dirCount, size, errorCount) {
  var elapsed = (performance.now() - start_time) / 1000;
  var totalItems = fileCount + dirCount;
  var itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
  var bytesPerSec = elapsed > 0 ? size / elapsed : 0;

  var statusText = "Scanning: " + formatNumber(fileCount) + " files | " +
    formatNumber(dirCount) + " dirs | " + format(size) + " | " +
    formatNumber(itemsPerSec) + " items/sec | " + format(bytesPerSec) + "/sec";

  if (errorCount && errorCount > 0) {
    statusText += " | " + formatNumber(errorCount) + " errors";
  }

  bottomStatus.textContent = statusText;
}

function startScan(path) {
  cleanup();
  hidePrompt();
  State.clearNavigation();
  legend.style("display", "block");
  log("start", path);
  start_time = performance.now();
  console.time("scan_job_time");
  isScanning = true;
  isPaused = false;
  updateScanButtons();

  sendIpcMsg("go", path);
}

function progress(dir, name, size, fileCount, dirCount, errorCount) {
  var pauseBtn = isPaused
    ? "<button class='btn btn-positive' onclick='resumeScan()' style='margin-top: 10px; margin-right: 5px;'>Resume Scan</button>"
    : "<button class='btn btn-default' onclick='pauseScan()' style='margin-top: 10px; margin-right: 5px;'>Pause Scan</button>";
  var statusText = isPaused ? "PAUSED" : "Scanning...";

  legend.html(
    "<h2>" + statusText + " <i>(try grabbing a drink..)</i></h2>" +
    "<p style='font-size: 0.8em; word-break: break-all; max-height: 60px; overflow: hidden;'>" +
    dir + "</p>" +
    "<br/>Scanned: " + format(size) +
    (errorCount > 0 ? " <span style='color: #c44;'>(" + errorCount + " errors)</span>" : "") +
    "<br/><br/>" +
    pauseBtn +
    "<button class='btn btn-negative' onclick='cancelScan()' style='margin-top: 10px;'>Cancel Scan</button>"
  );
  current_size = size;

  if (fileCount !== undefined && dirCount !== undefined) {
    updateStatsDisplay(fileCount, dirCount, size, errorCount);
  }
}

function lightbox(show) {
  var loading = document.getElementById("loading");
  var shades = document.getElementById("shades");
  var promptbox = document.getElementById("promptbox");
  loading.style.display = show ? "block" : "none";
  shades.style.display = show ? "flex" : "none";
  promptbox.style.display = show ? "none" : "";
  shades.style.opacity = show ? 0.8 : 1;
}

function refresh(json) {
  log("[renderer] refresh..");
  lightbox(true);
  legend.html("Generating preview...");

  setTimeout(() => {
    onJson(null, json);
    lightbox(false);
  }, 1000);
}

function cleanup() {
  mempoller.cancel();
  lightbox(true);
  PluginManager.cleanup();
}

function complete(json, finalStats) {
  log("[renderer] complete..", json);
  console.timeEnd("scan_job_time");
  isScanning = false;
  isPaused = false;
  updateScanButtons();

  console.time("a");
  onJson(null, json);
  legend.style("display", "none");
  lightbox(false);
  requestAnimationFrame(function () {
    console.timeEnd("a");
  });

  var time_took = performance.now() - start_time;
  log("Time took", (time_took / 60 / 1000).toFixed(2), "mins");

  var wasCancelled = finalStats && finalStats.cancelled;

  if (finalStats) {
    var elapsed = time_took / 1000;
    var totalItems = finalStats.fileCount + finalStats.dirCount;
    var itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
    var bytesPerSec = elapsed > 0 ? finalStats.currentSize / elapsed : 0;
    var timeStr =
      elapsed < 60 ? elapsed.toFixed(1) + "s" : (elapsed / 60).toFixed(1) + "m";

    var statusText = wasCancelled ? "CANCELLED: " : "Scanned: ";
    statusText += formatNumber(finalStats.fileCount) + " files | " +
      formatNumber(finalStats.dirCount) + " dirs | " +
      format(finalStats.currentSize) + " in " + timeStr +
      " (" + formatNumber(itemsPerSec) + " items/sec, " +
      format(bytesPerSec) + "/sec)";

    if (finalStats.errorCount && finalStats.errorCount > 0) {
      statusText += " | " + formatNumber(finalStats.errorCount) +
        " errors (permission denied, etc.)";
    }

    bottomStatus.textContent = statusText;
  }
}

// Cancel the current scan
function cancelScan() {
  if (!isScanning) {
    console.log("[renderer] No scan in progress to cancel");
    return;
  }
  console.log("[renderer] Cancelling scan...");
  isPaused = false;
  legend.html(
    "<h2>Cancelling scan...</h2>" +
    "<p>Please wait while the scan stops...</p>"
  );
  sendIpcMsg("cancel");
}

// Pause the current scan
function pauseScan() {
  if (!isScanning || isPaused) return;
  console.log("[renderer] Pausing scan...");
  isPaused = true;
  updateScanButtons();
  sendIpcMsg("pause");
}

// Resume the current scan
function resumeScan() {
  if (!isScanning || !isPaused) return;
  console.log("[renderer] Resuming scan...");
  isPaused = false;
  updateScanButtons();
  sendIpcMsg("resume");
}

// Update scan button visibility in footer
function updateScanButtons() {
  var cancelBtn = document.getElementById("cancel_scan_btn");
  var pauseBtn = document.getElementById("pause_scan_btn");

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

function ready() {
  showPrompt();
  // Set up RPC message handlers for scan progress/complete
  window._onScanProgress = function(data) {
    progress(data.path, data.name, data.size, data.fileCount, data.dirCount, data.errorCount);
  };
  window._onScanComplete = function(data) {
    complete(data.data, data.stats);
  };
  window._onColorChange = function(data) {
    handleColorChange(data.type, data.value);
  };

  // Auto-open folder picker
  try {
    console.log("[renderer] auto-opening folder picker on startup");
    scanFolder();
  } catch (e) {
    console.error("[renderer] auto-open picker failed", e);
  }
}

// Color change handler (from menu)
function handleColorChange(type, value) {
  if (typeof updateColorScheme === 'function') {
    updateColorScheme(type, value);
  }
}

// Ensure ready() runs when DOM is loaded
try {
  if (document && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
} catch (e) {
  console.error("[renderer] failed to register DOMContentLoaded", e);
}

function showPrompt() {
  var shades = document.getElementById("shades");
  var dir_opener = document.getElementById("dir_opener");
  shades.style.display = "flex";
  dir_opener.style.display = "none";
}

function hidePrompt() {
  var shades = document.getElementById("shades");
  var dir_opener = document.getElementById("dir_opener");
  shades.style.display = "none";
  dir_opener.style.display = "inline-block";
}

function scanRoot() {
  var ok = confirm("This may take some time, continue?");
  if (ok) {
    startScan("/");
  }
}

function newWindow() {
  log("new window - not supported in Electrobun single-window mode");
}

function scanFolder() {
  try {
    console.log("[renderer] scanFolder invoked");
    var rpc = getRPC();
    if (!rpc) {
      console.error("[renderer] RPC not available for scanFolder");
      return;
    }
    rpc.request.selectFolder().then(function(result) {
      console.log("[renderer] select-folder result", result);
      if (result && result.path) {
        selectPath(result.path);
      } else {
        console.log("[renderer] Folder selection canceled or failed");
      }
    }).catch(function(err) {
      console.error("[renderer] select-folder RPC error", err);
    });
  } catch (err) {
    console.error("[renderer] scanFolder error", err);
  }
}

function readFile() {
  try {
    var rpc = getRPC();
    if (!rpc) return;
    rpc.request.selectFile().then(function(result) {
      if (result && result.path) {
        selectPath(result.path);
      }
    });
  } catch (err) {
    console.error("[renderer] readFile error", err);
  }
}

function scanMemory() {
  mempoller.run();
}

document.ondragover = document.ondrop = function (e) {
  e.preventDefault();
  return false;
};

function welcomeDialog() {
  var shades = document.getElementById("shades");
  shades.style.display == "none" ? showPrompt() : hidePrompt();
}

function selectPath(path) {
  startScan(path);
  return;
}

var promptbox = document.getElementById("promptbox");
if (promptbox) {
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
    var file = e.dataTransfer.files[0];
    console.log("file", file);
    if (file) return selectPath(file.path || file.name);
  };
}

/*** Selection Handling ****/

function openDirectory() {
  var loc = Navigation.currentPath();
  if (loc) {
    var rpc = getRPC();
    if (rpc) {
      rpc.request.openDirectory({ dirPath: loc.join("/") });
    }
  }
}

function openSelection() {
  if (selection && !selection.children) {
    var file = key(selection);
    log("open selection", file);
    var rpc = getRPC();
    if (rpc) rpc.request.openExternal({ url: file });
  }
}

function showSelection() {
  if (selection) {
    var file = key(selection);
    log("show selection", file);
    var rpc = getRPC();
    if (rpc) rpc.request.openDirectory({ dirPath: file });
  }
}

function trashSelection() {
  if (selection) {
    var file = key(selection);
    var ok = confirm("Are you sure you wish to send " + file + " to the trash?");
    if (ok) {
      log("trash selection", file);
      var rpc = getRPC();
      if (rpc) {
        rpc.request.trashItem({ filePath: file }).then(function(result) {
          if (result && result.success) {
            alert(file + " moved to trash!\n(currently needs rescan to update graphs)");
          }
        });
      }
    }
  }
}

/*** Data Loading ****/

function onJson(error, data) {
  if (error) throw error;
  PluginManager.generate(data);
}

// Async version of _loadLast that uses RPC
function _loadLastAsync() {
  var rpc = getRPC();
  if (!rpc) return Promise.resolve(null);
  return rpc.request.loadLast().then(function(result) {
    return result ? result.data : null;
  }).catch(function() {
    return null;
  });
}

// Synchronous fallback (returns null, use async version)
function _loadLast() {
  console.warn("_loadLast called synchronously - use _loadLastAsync instead");
  _loadLastAsync().then(function(data) {
    if (data) PluginManager.generate(data);
  });
  return null;
}

function hideAll() {
  [...document.querySelectorAll(".mode_buttons")].forEach(button =>
    button.classList.remove("active")
  );
  [...document.querySelectorAll(".graph-container")].forEach(
    el => (el.style.display = "none")
  );
}

function deactivateCharts() {
  [sunburstGraph, treemapGraph, flamegraphGraph].forEach(chart =>
    PluginManager.deactivate(chart)
  );
}

function showSunburst() {
  hideAll();
  sunburst_button.classList.add("active");
  d3.select("#sunburst-canvas").style("display", "inline-block");
  d3.select("#sunburst-chart").style("display", "inline-block");

  deactivateCharts();
  PluginManager.activate(sunburstGraph);
}

function showTreemap() {
  hideAll();
  treemap_button.classList.add("active");
  d3.select("canvas").style("display", "inline-block");

  deactivateCharts();
  PluginManager.activate(treemapGraph);
}

function showFlamegraph() {
  hideAll();
  flamegraph_button.classList.add("active");
  document.getElementById("flame-chart").style.display = "inline-block";

  deactivateCharts();
  PluginManager.activate(flamegraphGraph);
}

d3.select(window).on("resize", function () {
  PluginManager.resize();
});
