"use strict";

const rpc = globalThis.__spaceRadarRpc;
const emitter = globalThis.__spaceRadarEmitter;

if (!rpc || !emitter) {
  throw new Error(
    "[electrobun] RPC bridge not initialized. Ensure app/mainview/index.ts runs first.",
  );
}

const ipcRenderer = {
  send(channel, payload) {
    switch (channel) {
      case "scan-go":
        return rpc.send.scanGo({ target: payload });
      case "cancel-scan":
        return rpc.send.scanCancel({});
      case "pause-scan":
        return rpc.send.scanPause({});
      case "resume-scan":
        return rpc.send.scanResume({});
      case "new-window":
        return rpc.send.openNewWindow({});
      default:
        console.warn(`[electrobun] Unhandled ipc send: ${channel}`);
        return undefined;
    }
  },
  invoke(channel, payload) {
    switch (channel) {
      case "select-folder":
        return rpc.request.selectFolder(payload || {});
      case "select-file":
        return rpc.request.selectFile(payload || {});
      case "get-disk-info":
        return rpc.request.getDiskInfo(payload || {});
      case "get-memory-snapshot":
        return rpc.request.getMemorySnapshot(payload || {});
      default:
        return Promise.reject(new Error(`[electrobun] Unknown invoke ${channel}`));
    }
  },
  on(channel, handler) {
    emitter.on(channel, handler);
  },
};

const shell = {
  openExternal(url) {
    rpc.send.shellOpenExternal({ url });
  },
  openItem(filePath) {
    rpc.send.shellOpenPath({ path: filePath });
  },
  showItemInFolder(filePath) {
    rpc.send.shellShowItemInFolder({ path: filePath });
  },
  moveItemToTrash(filePath) {
    rpc.send.shellMoveItemToTrash({ path: filePath });
    return true;
  },
  beep() {
    rpc.send.shellBeep({});
  },
};

const contextMenu = {
  show(items) {
    return rpc.request.showContextMenu({ items });
  },
  onAction(handler) {
    emitter.on("context-menu-action", (_, action) => handler(action));
  },
};

module.exports = {
  ipcRenderer,
  shell,
  contextMenu,
};
