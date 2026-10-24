const { contextBridge, ipcRenderer } = require("electron");
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld(
  "sco",
  Object.freeze({
    read: invoke("read"),
    save: invoke("save"),
    master: invoke("master"),
    settings: invoke("settings"),
    history: invoke("history"),
    exportExcel: invoke("export-excel"),
    previewImport: invoke("preview-import"),
    applyImport: invoke("apply-import"),
    cancelImport: invoke("cancel-import"),
    backup: invoke("backup"),
    openData: invoke("open-data"),
    dirty: invoke("dirty"),
    deleteCase: invoke("delete-case"),
    reset: invoke("reset"),
    archive: invoke("archive"),
    resolveClose: invoke("resolve-close"),
    onCloseRequested: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("confirm-close", listener);
      return () => ipcRenderer.removeListener("confirm-close", listener);
    },
  }),
);
