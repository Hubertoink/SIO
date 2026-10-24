const { app } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
app.setName("SIO Runtime Test");
app.whenReady().then(async () => {
  let dir, store;
  try {
    const { Store } = await import("../electron/store.mjs");
    const { readWorkbook, writeWorkbook } =
      await import("../electron/excel.mjs");
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "sio-runtime-"));
    store = new Store(path.join(dir, "runtime.sqlite"));
    const state = store.demo(0);
    assert.equal(state.cases.length, 6);
    const file = path.join(dir, "roundtrip.xlsx");
    await writeWorkbook(state, file);
    const imported = await readWorkbook(file);
    assert.equal(imported.state.cases.length, 6);
    assert.equal(imported.state.staff.length, 3);
    console.log(
      `PASS Electron ${process.versions.electron}: SQLite + Demodaten + Excel-Rundlauf`,
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    store?.close();
    if (
      dir &&
      path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      await fs.rm(dir, { recursive: true, force: true });
    app.exit(process.exitCode || 0);
  }
});
