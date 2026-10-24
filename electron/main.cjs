const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
  Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
app.setName("SIO");
if (process.platform === "win32") app.setAppUserModelId("de.sio.desktop");
// Preserve data from the first SCO test build without copying or overwriting it.
const legacyData = path.join(app.getPath("appData"), "SCO");
if (existsSync(path.join(legacyData, "sco.sqlite")))
  app.setPath("userData", legacyData);
if (process.env.SIO_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.SIO_DATA_DIR));
let win, store, pending;
const dirtySources = new Set();
let closeRequested = false;
const dataDir = app.getPath("userData");
const index = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
function fileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
async function backupTo(target) {
  const content = {
    format: "SIO-Backup",
    version: 1,
    createdAt: new Date().toISOString(),
    state: store.read(),
    history: store.allHistory(),
  };
  await fs.writeFile(target, JSON.stringify(content, null, 2), "utf8");
  return target;
}
async function autoBackup() {
  const dir = path.join(dataDir, "backups");
  await fs.mkdir(dir, { recursive: true });
  await backupTo(path.join(dir, `SIO-${fileStamp()}.json`));
  const files = (await fs.readdir(dir))
    .filter((f) => /^SIO-[\dTZ-]+\.json$/.test(f))
    .sort();
  for (const f of files.slice(0, -20)) await fs.unlink(path.join(dir, f));
}
async function safetyBackup(prefix) {
  const dir = path.join(dataDir, "backups");
  await fs.mkdir(dir, { recursive: true });
  return backupTo(path.join(dir, `${prefix}-${fileStamp()}.json`));
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url.split("#")[0] !== index
    )
      throw Error("Unzulässiger Zugriff.");
    if (JSON.stringify(args).length > 2000000)
      throw Error("Die Anfrage ist zu groß.");
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return {
        ok: false,
        error: e.message || "Die Aktion konnte nicht abgeschlossen werden.",
      };
    }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const { Store } = await import("./store.mjs");
      const { readWorkbook, writeWorkbook } = await import("./excel.mjs");
      await fs.mkdir(dataDir, { recursive: true });
      store = new Store(path.join(dataDir, "sco.sqlite"));
      if (store.read().cases.length) await autoBackup();
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, cb) => cb(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, cb) =>
        cb({
          cancel:
            !details.url.startsWith("file:") &&
            !details.url.startsWith("devtools:"),
        }),
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { label: "SIO", submenu: [{ role: "quit", label: "Beenden" }] },
          {
            label: "Bearbeiten",
            submenu: [
              { role: "undo", label: "Rückgängig" },
              { role: "redo", label: "Wiederholen" },
              { type: "separator" },
              { role: "cut", label: "Ausschneiden" },
              { role: "copy", label: "Kopieren" },
              { role: "paste", label: "Einfügen" },
              { role: "selectAll", label: "Alles auswählen" },
            ],
          },
          {
            label: "Ansicht",
            submenu: [
              { role: "resetZoom", label: "Originalgröße" },
              { role: "zoomIn", label: "Vergrößern" },
              { role: "zoomOut", label: "Verkleinern" },
              { role: "togglefullscreen", label: "Vollbild" },
            ],
          },
        ]),
      );
      win = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 900,
        minHeight: 650,
        backgroundColor: "#eef1ff",
        title: "SIO",
        icon: path.join(__dirname, "../assets/SIO_Logo.ico"),
        show: !process.env.SIO_TEST,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (event, url) => {
        if (url.split("#")[0] !== index) event.preventDefault();
      });
      win.on("close", (e) => {
        if (dirtySources.size) {
          e.preventDefault();
          if (!closeRequested) {
            closeRequested = true;
            win.webContents.send("confirm-close");
          }
        }
      });
      handle("resolve-close", (discard) => {
        if (!closeRequested) return;
        closeRequested = false;
        if (discard === true) {
          dirtySources.clear();
          win.close();
        }
      });
      handle("read", () => ({
        state: store.read(),
        dataDir,
        version: app.getVersion(),
      }));
      handle("save", (kind, record, revision) =>
        store.save(kind, record, revision),
      );
      handle("master", (kind, record, revision) =>
        store.master(kind, record, revision),
      );
      handle("settings", (s, r) => store.settings(s, r));
      handle("history", (id) => store.history(String(id)));
      handle("archive", (kind, id, archived, revision) =>
        store.archive(kind, id, archived, revision),
      );
      handle("delete-case", async (id, confirmation, revision) => {
        if (!id || confirmation !== id)
          throw Error("Bitte die Fall-ID bestätigen.");
        const backupPath = await safetyBackup("Vor-Loeschung");
        return {
          state: store.removeCase(id, confirmation, revision),
          backupPath,
        };
      });
      handle("reset", async (confirmation, revision) => {
        if (confirmation !== "RESET") throw Error("Bitte RESET bestätigen.");
        const backupPath = await safetyBackup("Vor-Reset");
        const state = store.reset(confirmation, revision);
        pending = undefined;
        dirtySources.clear();
        return { state, backupPath };
      });
      handle("dirty", (source, value) => {
        if (typeof source !== "string")
          throw Error("Ungültiger Formularstatus.");
        if (value) dirtySources.add(source);
        else dirtySources.delete(source);
      });
      handle("open-data", () => shell.openPath(dataDir));
      handle("export-excel", async () => {
        const res = await dialog.showSaveDialog(win, {
          title: "Excel exportieren",
          defaultPath: `SIO-Faelle-${new Date().toISOString().slice(0, 10)}.xlsx`,
          filters: [{ name: "Excel-Arbeitsmappe", extensions: ["xlsx"] }],
        });
        if (res.canceled) return null;
        await writeWorkbook(store.read(), res.filePath);
        return res.filePath;
      });
      handle("backup", async () => {
        const res = await dialog.showSaveDialog(win, {
          title: "Datensicherung speichern",
          defaultPath: `SIO-Sicherung-${fileStamp()}.json`,
          filters: [{ name: "SIO-Datensicherung", extensions: ["json"] }],
        });
        if (res.canceled) return null;
        return backupTo(res.filePath);
      });
      handle("preview-import", async () => {
        const res = await dialog.showOpenDialog(win, {
          title: "Excel oder SIO-Sicherung importieren",
          properties: ["openFile"],
          filters: [{ name: "SIO-Daten", extensions: ["xlsx", "json"] }],
        });
        if (res.canceled) return null;
        const source = res.filePaths[0];
        const stat = await fs.stat(source);
        if (stat.size > 25 * 1024 * 1024)
          throw Error("Die Datei ist größer als 25 MB.");
        let parsed;
        if (path.extname(source).toLowerCase() === ".json") {
          const backup = JSON.parse(await fs.readFile(source, "utf8"));
          if (
            !["SIO-Backup", "SCO-Backup"].includes(backup.format) ||
            backup.version !== 1
          )
            throw Error("Keine gültige SIO-Sicherung.");
          const { validateState } = await import("./store.mjs");
          validateState(backup.state);
          parsed = {
            state: backup.state,
            history: backup.history,
            notes: [
              "Verlauf und Einstellungen werden aus der Sicherung wiederhergestellt.",
            ],
          };
        } else parsed = await readWorkbook(source);
        pending = { ...parsed, revision: store.read().revision };
        return {
          name: path.basename(source),
          cases: parsed.state.cases.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
          })),
          staff: parsed.state.staff.length,
          notes: parsed.notes,
          existing: store.read().cases.length,
          settings: parsed.state.settings,
        };
      });
      handle("apply-import", async () => {
        if (!pending) throw Error("Bitte zuerst eine Datei auswählen.");
        const p = pending;
        await autoBackup();
        const state = store.import(p.state, p.revision, p.history);
        pending = null;
        return state;
      });
      handle("cancel-import", () => {
        pending = null;
      });
      await win.loadFile(path.join(__dirname, "../dist/index.html"));
    })
    .catch((e) => {
      dialog.showErrorBox("SIO konnte nicht starten", e.message);
      app.quit();
    });
  app.on("window-all-closed", () => {
    store?.close();
    app.quit();
  });
}
