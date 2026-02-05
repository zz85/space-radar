"use strict";

const { shell } = require("electron");
const path = require("path");
// si (systeminformation) is already loaded by mem.js

const LASTLOAD_FILE = path.join(__dirname, "lastload.json");

// Track scanning state
var isScanning = false;
var isPaused = false;

// IPC handling
function sendIpcMsg(cmd, msg) {
  try {
    const { ipcRenderer } = require("electron");
    if (cmd === "go") {
      console.log("[renderer] sending scan-go", msg);
      ipcRenderer.send("scan-go", msg);
    } else if (cmd === "cancel") {
      console.log("[renderer] sending cancel-scan");
      ipcRenderer.send("cancel-scan");
    } else if (cmd === "pause") {
      console.log("[renderer] sending pause-scan");
      ipcRenderer.send("pause-scan");
    } else if (cmd === "resume") {
      console.log("[renderer] sending resume-scan");
      ipcRenderer.send("resume-scan");
    }
  } catch (err) {
    console.error("[renderer] sendIpcMsg error", err);
  }
}

var current_size = 0,
  start_time,
  lastStatsUpdate = 0;

// Store disk info for adding free space to visualization
var currentDiskInfo = null;

var legend = d3.select("#legend");
var bottomStatus = document.getElementById("bottom_status");

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update stats display in footer
function updateStatsDisplay(fileCount, dirCount, size, errorCount) {
  const elapsed = (performance.now() - start_time) / 1000; // seconds
  const totalItems = fileCount + dirCount;
  const itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
  const bytesPerSec = elapsed > 0 ? size / elapsed : 0;

  let statusText = `Scanning: ${formatNumber(fileCount)} files | ${formatNumber(
    dirCount,
  )} dirs | ${format(size)} | ${formatNumber(itemsPerSec)} items/sec | ${format(
    bytesPerSec,
  )}/sec`;

  // Show error count if there are any errors
  if (errorCount && errorCount > 0) {
    statusText += ` | ${formatNumber(errorCount)} errors`;
  }

  bottomStatus.textContent = statusText;
}

// Function to get disk space info for a given path
function getDiskSpaceInfo(scanPath, callback) {
  if (!si) {
    callback(new Error("systeminformation not available"));
    return;
  }

  si.fsSize()
    .then((drives) => {
      // Normalize paths for cross-platform comparison
      const normalizedScanPath = scanPath.replace(/\\/g, "/");

      // On macOS with APFS, /System/Volumes/Data is where user data actually lives
      // but paths appear as /Users/... (symlinked). We need to check both.
      const isMac = process.platform === "darwin";
      const dataVolumePrefix = "/System/Volumes/Data";

      // Find the drive with the longest matching mount point
      // This handles nested mount points correctly (e.g., /home vs /)
      let bestMatch = null;
      let longestMatchLength = 0;

      drives.forEach((d) => {
        const normalizedMount = d.mount.replace(/\\/g, "/");

        // Check if scan path matches this mount
        let matches = normalizedScanPath.startsWith(normalizedMount);

        // On macOS, also check if this is the Data volume and scan path is a user path
        // User paths like /Users/... are actually on /System/Volumes/Data
        if (isMac && normalizedMount === dataVolumePrefix) {
          // Data volume should match most user-accessible paths
          if (
            normalizedScanPath.startsWith("/Users") ||
            normalizedScanPath.startsWith("/Applications") ||
            normalizedScanPath.startsWith("/Library") ||
            normalizedScanPath.startsWith("/opt") ||
            normalizedScanPath.startsWith("/usr/local")
          ) {
            matches = true;
            // Give Data volume higher priority than root for user paths
            if (longestMatchLength <= 1) {
              longestMatchLength = dataVolumePrefix.length;
              bestMatch = d;
              return;
            }
          }
        }

        if (matches && normalizedMount.length > longestMatchLength) {
          longestMatchLength = normalizedMount.length;
          bestMatch = d;
        }
      });

      // Fallback to first drive if no match found
      const drive = bestMatch || drives[0];

      if (drive) {
        callback(null, {
          total: drive.size,
          used: drive.used,
          available: drive.available,
          usePercent: drive.use,
        });
      } else {
        callback(new Error("No drive found"));
      }
    })
    .catch((err) => {
      console.error("Error getting disk space info:", err);
      callback(err);
    });
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

  var stat = fs.lstatSync(path);
  log("file", stat.isFile(), "dir", stat.isDirectory());

  // Get and display disk space info
  currentDiskInfo = null; // Reset
  getDiskSpaceInfo(path, (err, diskInfo) => {
    const diskSpaceElement = document.getElementById("disk_space_info");

    if (err || !diskInfo) {
      if (diskSpaceElement)
        diskSpaceElement.textContent = "Disk info unavailable";
      return;
    }

    // Store for later use in visualization
    currentDiskInfo = diskInfo;

    if (diskSpaceElement) {
      // Handle potential null/undefined usePercent
      const usePercent =
        diskInfo.usePercent != null ? diskInfo.usePercent.toFixed(2) : "0.00";
      const diskInfoText = `Total: ${format(diskInfo.total)} | Free: ${format(
        diskInfo.available,
      )} | Used: ${format(diskInfo.used)} (${usePercent}%)`;
      diskSpaceElement.textContent = diskInfoText;
    }
  });

  // return sendIpcMsg('go', path);
  if (stat.isFile()) {
    const json = new duFromFile.iNode();
    duFromFile(
      {
        parent: path,
        node: json,
        onprogress: progress,
        // onrefresh: refresh
      },
      () => {
        complete(json);
      },
    );
  } else {
    sendIpcMsg("go", path);
  }
}

function start_read() {
  console.log("start_read");

  const json = new duFromFile.iNode();
  duFromFile(
    {
      parent: "./output.txt",
      node: json,
      onprogress: progress,
      // onrefresh: refresh
    },
    () => {
      return complete(json);
    },
  );
}

function progress(dir, name, size, fileCount, dirCount, errorCount) {
  // log('[' + ipc_name + '] progress', name)
  // Show current scanning path in legend for visibility with pause/cancel buttons
  const pauseBtn = isPaused
    ? "<button class='btn btn-positive' onclick='resumeScan()' style='margin-top: 10px; margin-right: 5px;'>Resume Scan</button>"
    : "<button class='btn btn-default' onclick='pauseScan()' style='margin-top: 10px; margin-right: 5px;'>Pause Scan</button>";
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
      "<button class='btn btn-negative' onclick='cancelScan()' style='margin-top: 10px;'>Cancel Scan</button>",
  );
  current_size = size;

  // Update footer stats display
  if (fileCount !== undefined && dirCount !== undefined) {
    updateStatsDisplay(fileCount, dirCount, size, errorCount);
  }
}

function lightbox(show) {
  loading.style.display = show ? "block" : "none";
  shades.style.display = show ? "flex" : "none";
  promptbox.style.display = show ? "none" : "";
  shades.style.opacity = show ? 0.8 : 1;
}

function refresh(json) {
  log("[" + ipc_name + "] refresh..");

  // should disable all inputs here because redraw would probably be intensive
  lightbox(true);
  legend.html("Generating preview...");

  setTimeout(() => {
    onJson(null, json);
    lightbox(false);
  }, 1000);
}

function cleanup() {
  // we have a possibility of running out of memory here, we could force a garbage collection to compact memory a little if neede!
  mempoller.cancel();
  lightbox(true);
  PluginManager.cleanup();

  // memory()
}

function complete(json, finalStats) {
  log("[" + ipc_name + "] complete..", json);
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

  // Check if scan was cancelled
  const wasCancelled = finalStats && finalStats.cancelled;

  // Show final stats in footer
  if (finalStats) {
    const elapsed = time_took / 1000;
    const totalItems = finalStats.fileCount + finalStats.dirCount;
    const itemsPerSec = elapsed > 0 ? Math.round(totalItems / elapsed) : 0;
    const bytesPerSec = elapsed > 0 ? finalStats.current_size / elapsed : 0;
    const timeStr =
      elapsed < 60 ? elapsed.toFixed(1) + "s" : (elapsed / 60).toFixed(1) + "m";

    let statusText = wasCancelled ? "CANCELLED: " : "Scanned: ";
    statusText += `${formatNumber(
      finalStats.fileCount,
    )} files | ${formatNumber(finalStats.dirCount)} dirs | ${format(
      finalStats.current_size,
    )} in ${timeStr} (${formatNumber(itemsPerSec)} items/sec, ${format(
      bytesPerSec,
    )}/sec)`;

    // Show error count if there were any errors
    if (finalStats.errorCount && finalStats.errorCount > 0) {
      statusText += ` | ${formatNumber(
        finalStats.errorCount,
      )} errors (permission denied, etc.)`;
    }

    bottomStatus.textContent = statusText;
  }

  // webview.remove()
  // TODO add growl notification here
  // shell.beep() // disabling as this can be anonying for memory monitor
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
      "<p>Please wait while the scan stops...</p>",
  );
  sendIpcMsg("cancel");
}

// Pause the current scan
function pauseScan() {
  if (!isScanning || isPaused) {
    console.log("[renderer] Cannot pause - not scanning or already paused");
    return;
  }
  console.log("[renderer] Pausing scan...");
  isPaused = true;
  updateScanButtons();
  sendIpcMsg("pause");
}

// Resume the current scan
function resumeScan() {
  if (!isScanning || !isPaused) {
    console.log("[renderer] Cannot resume - not scanning or not paused");
    return;
  }
  console.log("[renderer] Resuming scan...");
  isPaused = false;
  updateScanButtons();
  sendIpcMsg("resume");
}

// Update scan button visibility in footer
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

function handleIPC(cmd, args) {
  try {
    console.log("[renderer] handleIPC", cmd);
  } catch (e) {}
  switch (cmd) {
    case "progress":
      return progress.apply(null, args);
    case "refresh":
      return refresh.apply(null, args);
    case "complete":
      try {
        console.log("[renderer] complete received");
      } catch (e) {}
      return complete(args[0], args[1]);
    case "fs-ipc":
      try {
        console.log("[renderer] fs-ipc received", args && args[0]);
      } catch (e) {}
      return fsipc(args[0]);
    case "du_pipe_start":
      return start_read();
  }
}

function runNext(f) {
  setTimeout(f, 10);
}

function fsipc(filename) {
  console.time("fsipc");
  cleanup();
  log(filename);

  runNext(() => {
    try {
      var args = fs.readFileSync(filename);
      args = zlib.inflateSync(args);
      args = JSON.parse(args);
      var cmd = args.shift();
      try {
        console.log("[renderer] fsipc dispatch", cmd);
      } catch (e) {}
      handleIPC(cmd, args);
    } catch (e) {
      console.error(e.stack);
    }
    console.timeEnd("fsipc");
  });
}

function ready() {
  // start here
  showPrompt();
  try {
    console.log("[renderer] auto-opening folder picker on startup");
    scanFolder();
  } catch (e) {
    console.error("[renderer] auto-open picker failed", e);
  }
  // fsipc('fs-ipc.json')
}

// Ensure ready() runs when DOM is loaded regardless of IPC bootstrap
try {
  if (document && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    // Document already ready
    ready();
  }
} catch (e) {
  console.error("[renderer] failed to register DOMContentLoaded", e);
}

function rerunPage() {
  remote.getCurrentWindow().reload();
}

function showPrompt() {
  shades.style.display = "flex";
  dir_opener.style.display = "none";
}

function hidePrompt() {
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
  log("new window");
  const { ipcRenderer } = require("electron");
  ipcRenderer.send("new-window");
}

function scanFolder() {
  try {
    console.log("[renderer] scanFolder invoked");
    const { ipcRenderer } = require("electron");
    Promise.resolve(ipcRenderer.invoke("select-folder"))
      .then((selectedPath) => {
        console.log("[renderer] select-folder result", selectedPath);
        if (selectedPath) {
          selectPath(selectedPath);
        } else {
          console.log("[renderer] Folder selection canceled or failed");
        }
      })
      .catch((err) => {
        console.error("[renderer] select-folder IPC error", err);
      });
  } catch (err) {
    console.error("[renderer] scanFolder error", err);
  }
}

function readFile() {
  var dialog = remote.dialog;
  var selection = dialog.showOpenDialog({ properties: ["openFile"] });

  if (selection && selection[0]) {
    const file = selection[0];
    selectPath(file);
  }
}

function scanMemory() {
  mempoller.run();
}

document.ondragover = document.ondrop = function (e) {
  e.preventDefault();
  // prevent anyhow drag
  return false;
};

function welcomeDialog() {
  shades.style.display == "none" ? showPrompt() : hidePrompt();
}

function selectPath(path) {
  startScan(path);
  return;
}

var promptbox = document.getElementById("promptbox");
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
  // return
  if (file) return selectPath(file.path);
};

/*** Selection Handling ****/

function openDirectory() {
  let loc = Navigation.currentPath();
  if (loc) shell.showItemInFolder(loc.join(path.sep));
}

function openSelection() {
  if (selection && !selection.children) {
    let file = key(selection);
    log("open selection", file);
    shell.openItem(file);
  }
}

function externalSelection() {
  if (selection) {
    let file = key(selection);
    log("openExternal selection", file);
    shell.openExternal(file);
  }
}

function showSelection() {
  if (selection) {
    let file = key(selection);
    log("show selection", file);
    shell.showItemInFolder(file);
  }
}

function trashSelection() {
  if (selection) {
    let file = key(selection);
    var ok = confirm(
      "Are you sure you wish to send " + file + " to the trash?",
    );
    if (ok) {
      log("trash selection", file);
      if (shell.moveItemToTrash(file)) {
        alert(
          file + " moved to trash!\n(currently needs rescan to update graphs)",
        );
        shell.beep();
      }
    }
  }
}

/*** Data Loading ****/

function onJson(error, data) {
  if (error) throw error;

  // Add free space as a child of root if disk info is available
  if (currentDiskInfo && currentDiskInfo.available > 0) {
    // Ensure children array exists
    if (!data.children) {
      data.children = [];
    }

    // Remove any existing free space node (in case of refresh)
    data.children = data.children.filter((c) => !c._isFreeSpace);

    // Add free space node
    data.children.push({
      name: "Free Space",
      size: currentDiskInfo.available,
      _isFreeSpace: true, // Mark for special handling
    });

    console.log(
      "Added free space to visualization:",
      format(currentDiskInfo.available),
    );
  }

  const jsonStr = JSON.stringify(data);
  const before = Buffer.byteLength(jsonStr);
  const zJsonStr = zlib.deflateSync(jsonStr);
  const after = Buffer.byteLength(zJsonStr);
  console.log("ONJSON", before, after, ((before - after) / after).toFixed(2));

  fs.writeFileSync(LASTLOAD_FILE, zJsonStr);
  PluginManager.generate(data);
  // PluginManager.loadLast()
}

function _loadLast() {
  return JSON.parse(zlib.inflateSync(fs.readFileSync(LASTLOAD_FILE)));
}

function hideAll() {
  // toggle button states
  [...document.querySelectorAll(".mode_buttons")].forEach((button) =>
    button.classList.remove("active"),
  );
  [...document.querySelectorAll(".graph-container")].forEach(
    (el) => (el.style.display = "none"),
  );

  // // hide sunburst
  // d3.select('#sunburst-chart').style('display', 'none')

  // // hide treemap canvas
  // d3.select('canvas').style('display', 'none')

  // // hide flamegraph
  // document.getElementById('flame-chart').style.display = 'none'
}

function deactivateCharts() {
  [sunburstGraph, treemapGraph, flamegraphGraph].forEach((chart) =>
    PluginManager.deactivate(chart),
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
