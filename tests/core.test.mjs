import { withDemoData } from "./demo-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { blueprintFixture } from "./fixtures.mjs";
import JSZip from "jszip";
import { readFile, writeFile } from "node:fs/promises";
import {
  newCase,
  newStaff,
  emptyState,
  overview,
  deadlineStatus,
  addDays,
  validDate,
  validateRecord,
  similarity,
  staffLabel,
  deadlineDistance,
  selectable,
} from "../shared/model.mjs";
import { Store } from "../electron/store.mjs";

test("Fallarchiv, Löschung und Reset schützen Daten und Revisionen", () => {
  const store = new Store(":memory:");
  try {
    let s = store.save("cases", { ...newCase(), name: "Erster Fall" }, 0).state;
    const id = s.cases[0].id;
    s = store.archive("cases", id, true, s.revision);
    assert.equal(overview(s.cases[0], s.settings).status, "Archiviert");
    assert.equal(overview(s.cases[0], s.settings).next, "");
    s = store.archive("cases", id, false, s.revision);
    assert.equal(s.cases[0].status, "Neu");
    assert.throws(() => store.removeCase(id, "falsch", s.revision));
    assert.throws(() => store.removeCase(id, id, 0));
    assert.equal(store.read().cases.length, 1);
    assert.equal(store.history(id).length, 3);
    s = store.removeCase(id, id, s.revision);
    assert.equal(store.history(id).length, 0);
    s = store.save(
      "cases",
      { ...newCase(), name: "Zweiter Fall" },
      s.revision,
    ).state;
    assert.notEqual(s.cases[0].id, id);
    assert.throws(() => store.reset("reset", s.revision));
    assert.throws(() => store.reset("RESET", 0));
    assert.equal(store.read().cases.length, 1);
    s = store.reset("RESET", s.revision);
    const { revision, ...data } = s;
    assert.deepEqual(data, emptyState());
    assert.deepEqual(store.allHistory(), []);
  } finally {
    store.close();
  }
});

test("Excel erhält Fallarchiv ohne aktive Fristwarnungen", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sio-archive-"));
  const state = withDemoData(emptyState());
  state.cases[0].archivedAt = new Date().toISOString();
  try {
    const file = path.join(dir, "archive.xlsx");
    await writeWorkbook(state, file);
    const parsed = await readWorkbook(file);
    assert.equal(parsed.state.cases[0].archivedAt, state.cases[0].archivedAt);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(file);
    assert.equal(
      book.getWorksheet("Fallliste").getCell("F8").result,
      "Archiviert",
    );
    assert.match(book.getWorksheet("Fallliste").getCell("F8").formula, /Y8/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
import { readWorkbook, writeWorkbook } from "../electron/excel.mjs";
const now = "2026-10-24";
test("Fristabstand zeigt Richtung, Singular, heute und keine Zahl für fehlende/beendete Termine", () => {
  assert.deepEqual(deadlineDistance("2026-10-25", "Geplant", now), {
    days: 1,
    direction: "down",
    text: "Noch 1 Tag",
  });
  assert.deepEqual(deadlineDistance("2026-10-20", "Überfällig", now), {
    days: -4,
    direction: "up",
    text: "4 Tage überfällig",
  });
  assert.equal(deadlineDistance(now, "Heute fällig", now).text, "Heute fällig");
  assert.equal(deadlineDistance("", "Termin fehlt", now), null);
  assert.equal(deadlineDistance(now, "Beendet", now), null);
});
test("Archivierung erhält Beziehungen, verhindert neue Zuordnungen und ist reversibel", () => {
  const store = new Store(":memory:");
  try {
    let state = store.import(withDemoData(emptyState()), 0),
      c = state.cases[0];
    const staffId = c.staffId,
      schoolId = c.schoolId;
    state = store.archive("staff", staffId, true, state.revision);
    state = store.archive("schools", schoolId, true, state.revision);
    assert.equal(state.cases[0].staffId, staffId);
    assert.equal(state.cases[0].schoolId, schoolId);
    assert.equal(
      selectable(state.staff).some((x) => x.id === staffId),
      false,
    );
    assert.ok(selectable(state.staff, staffId).some((x) => x.id === staffId));
    assert.throws(
      () =>
        store.save(
          "cases",
          { ...newCase(), name: "Neu", staffId },
          state.revision,
        ),
      /archiviert/,
    );
    assert.throws(
      () =>
        store.save(
          "cases",
          { ...newCase(), name: "Neu", schoolId },
          state.revision,
        ),
      /archiviert/,
    );
    state = store.save(
      "cases",
      { ...c, notes: "Geändert" },
      state.revision,
    ).state;
    state = store.save(
      "staff",
      { ...state.staff.find((x) => x.id === staffId), phone: "0000" },
      state.revision,
    ).state;
    assert.ok(state.staff.find((x) => x.id === staffId).archivedAt);
    state = store.master(
      "schools",
      {
        ...state.schools.find((x) => x.id === schoolId),
        name: "Archivierte Schule",
      },
      state.revision,
    ).state;
    assert.ok(state.schools[0].archivedAt);
    assert.ok(
      store.history(c.id).some((h) => h.action === "Begleitung geändert"),
    );
    state = store.archive("staff", staffId, false, state.revision);
    assert.equal(selectable(state.staff).length, state.staff.length);
  } finally {
    store.close();
  }
});
test("Excel-Rundlauf erhält auch archivierte und unbenutzte Schulen samt stabilen Zuordnungen", async () => {
  const store = new Store(":memory:");
  const dir = await mkdtemp(path.join(os.tmpdir(), "sio-archive-"));
  try {
    let state = store.import(withDemoData(emptyState()), 0);
    const c = state.cases[0];
    state = store.archive("schools", c.schoolId, true, state.revision);
    state = store.archive("staff", c.staffId, true, state.revision);
    state = store.master(
      "schools",
      { name: "Unbenutzte Schule", municipalityId: state.municipalities[0].id },
      state.revision,
    ).state;
    const file = path.join(dir, "export.xlsx");
    await writeWorkbook(state, file);
    const parsed = await readWorkbook(file);
    assert.deepEqual(parsed.state.schools, state.schools);
    assert.deepEqual(parsed.state.staff, state.staff);
    assert.equal(parsed.state.cases[0].schoolId, c.schoolId);
    const w = new ExcelJS.Workbook();
    await w.xlsx.readFile(file);
    assert.equal(
      w.getWorksheet("Begleitungen").getCell("O8").result,
      undefined,
    );
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Fristen: überfällig, heute, Warnschwelle inklusive, geplant", () => {
  assert.equal(deadlineStatus("2026-10-23", 7, now), "Überfällig");
  assert.equal(deadlineStatus(now, 7, now), "Heute fällig");
  assert.equal(deadlineStatus("2026-10-31", 7, now), "Bald fällig");
  assert.equal(deadlineStatus("2026-11-01", 7, now), "Geplant");
  assert.equal(deadlineStatus("", 7, now), "Termin fehlt");
});
test("Kalenderdaten: Schaltjahr und Zeitumstellung", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2024-02-28", 2), "2024-03-01");
});
test("Mehrere Fristarten werden gebündelt; Rechnungsabstand folgt Einstellung", () => {
  const c = {
    ...newCase(),
    approvalDate: "2026-10-23",
    planDate: "2026-10-28",
    invoiceDate: "2026-10-01",
  };
  const s = {
    approvalWarning: 30,
    planWarning: 30,
    invoiceInterval: 23,
    invoiceWarning: 3,
  };
  const o = overview(c, s, now);
  assert.equal(o.invoiceDue, now);
  assert.equal(o.status, "Überfällig");
  assert.equal(o.due, "Bewilligung, Bedarfsplanung, Rechnungsstellung");
  assert.equal(o.days, -1);
  assert.equal(
    overview(c, { ...s, invoiceInterval: 365 }, now).invoiceDue,
    "2027-10-01",
  );
});
test("Leere Daten erzeugen keinen Nulltermin; beendete Fälle sind still", () => {
  const s = emptyState().settings;
  const o = overview(newCase(), s, now);
  assert.equal(o.next, "");
  assert.equal(o.days, null);
  assert.equal(o.status, "Termine ergänzen");
  assert.match(o.due, /letztes Datum fehlt/);
  const ended = overview(
    { ...newCase(), status: "Beendet", approvalDate: "2020-01-01" },
    s,
    now,
  );
  assert.equal(ended.status, "Beendet");
  assert.equal(ended.next, "");
  assert.equal(ended.due, "");
  assert.ok(ended.deadlines.every((d) => d.status === "Beendet"));
});
test("Vergangene Dokumentation, Stunden und Verknüpfungen werden validiert", () => {
  const c = {
    ...newCase(),
    name: "Test",
    invoiceDate: "2026-10-25",
    email: "ungueltig",
    hours: -1,
    staffId: "IB-404",
  };
  const e = validateRecord("cases", c, emptyState(), now);
  assert.ok(e.invoiceDate && e.email && e.hours && e.staffId);
  assert.ok(similarity("Grundschule am Park", "Grundschüler am Park") > 0.72);
});
test("SQLite speichert dauerhaft, schützt Revisionen und protokolliert Änderungen atomar", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sco-store-"));
  let s;
  try {
    s = new Store(path.join(dir, "sco.sqlite"));
    const c = s.save("cases", { ...newCase(), name: "Testfall" }, 0);
    assert.equal(c.id, "F-001");
    assert.equal(s.history(c.id)[0].action, "Erstellt");
    assert.throws(
      () => s.save("cases", { ...c.state.cases[0], name: "Veraltet" }, 0),
      /zwischenzeitlich/,
    );
    assert.equal(s.read().cases[0].name, "Testfall");
    const v = s.save(
      "cases",
      { ...c.state.cases[0], diagnosis: "Testeintrag" },
      1,
    );
    assert.equal(v.state.revision, 2);
    assert.equal(s.history(c.id)[0].changes[0].field, "Diagnose");
    s.close();
    s = new Store(path.join(dir, "sco.sqlite"));
    assert.equal(s.read().cases[0].diagnosis, "Testeintrag");
    assert.equal(s.history(c.id).length, 2);
  } finally {
    s?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Stammdaten lassen normalisierte Dubletten nicht zu", () => {
  const s = new Store(":memory:");
  try {
    const r = s.master("municipalities", { name: "Mannheim" }, 0);
    assert.throws(
      () =>
        s.master("municipalities", { name: "  MANNHEIM " }, r.state.revision),
      /existiert bereits/,
    );
    const school = s.master(
      "schools",
      { name: "Schule", municipalityId: r.id },
      r.state.revision,
    );
    assert.equal(school.state.schools.length, 1);
  } finally {
    s.close();
  }
});
test("Import ist transaktional; ungültige Referenzen ersetzen keine Daten", () => {
  const store = new Store(":memory:");
  try {
    store.save("cases", { ...newCase(), name: "Bleibt" }, 0);
    const incoming = emptyState();
    incoming.cases = [
      { ...newCase(), id: "F-999", name: "Falsch", staffId: "missing" },
    ];
    assert.throws(() => store.import(incoming, 1), /existiert nicht/);
    assert.equal(store.read().cases[0].name, "Bleibt");
  } finally {
    store.close();
  }
});
test("Excel-Blueprint importiert alle sieben Fälle und den geänderten Rechnungsabstand", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sio-blueprint-"));
  try {
    const file = path.join(dir, "blueprint.xlsx");
    await writeWorkbook(blueprintFixture(), file, now);
    // Exercise valid prefixed OOXML used by some Excel template producers.
    const zip = await JSZip.loadAsync(await readFile(file));
    const xml = await zip.file("xl/workbook.xml").async("string");
    zip.file(
      "xl/workbook.xml",
      xml
        .replace(
          'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        )
        .replace(/<(\/?)([A-Za-z][\w]*)(?=[\s/>])/g, "<$1x:$2"),
    );
    await writeFile(file, await zip.generateAsync({ type: "nodebuffer" }));
    const { state } = await readWorkbook(file);
    assert.equal(state.cases.length, 7);
    assert.equal(state.staff.length, 3);
    assert.equal(state.settings.invoiceInterval, 365);
    assert.equal(state.cases[6].id, "F-007");
    assert.equal(state.cases[6].approvalDate, "2026-12-31");
    assert.ok(state.schools.some((s) => s.name === "Testschule Nord"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Excel Export / Reimport bewahrt Eingaben, Beziehungen, Datumstypen und Einstellungen", async () => {
  const state = blueprintFixture();
  const dir = await mkdtemp(path.join(os.tmpdir(), "sco-excel-"));
  try {
    const file = path.join(dir, "export.xlsx");
    await writeWorkbook(state, file, now);
    const { state: round } = await readWorkbook(file);
    assert.deepEqual(round.settings, state.settings);
    assert.deepEqual(round.staff, state.staff);
    const canonical = (s) =>
      s.cases.map((c) => ({
        ...c,
        schoolId: s.schools.find((x) => x.id === c.schoolId)?.name || "",
        municipalityId:
          s.municipalities.find((x) => x.id === c.municipalityId)?.name || "",
      }));
    assert.deepEqual(canonical(round), canonical(state));
    const w = new ExcelJS.Workbook();
    await w.xlsx.readFile(file);
    assert.deepEqual(
      w.worksheets.map((s) => s.name),
      ["Fallliste", "Fälle", "Begleitungen", "Auswertung"],
    );
    assert.equal(w.getWorksheet("Fälle").getCell("F7").value, "Diagnose");
    assert.equal(
      w.getWorksheet("Fälle").getCell("G8").value,
      staffLabel(state.staff[1]),
    );
    assert.equal(
      w.getWorksheet("Fallliste").getCell("Q8").result.toISOString(),
      "2027-10-23T00:00:00.000Z",
    );
    for (const sh of w.worksheets)
      sh.eachRow((row) =>
        row.eachCell((cell) => assert.ok(!cell.value?.error, cell.address)),
      );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
