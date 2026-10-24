import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  emptyState,
  newCase,
  newStaff,
  labels,
  caseKeys,
  dateKeys,
  staffLabel,
  normalize,
  overview,
  resolve,
  warnings,
  today,
  caseStatus,
  docStatus,
  reportStatus,
  validDate,
} from "../shared/model.mjs";
import { validateState } from "./store.mjs";
const caseHeaders = caseKeys.map((k) =>
  k === "staffId" ? "Begleitung auswählen" : labels[k],
);
const staffFields = [
  "id",
  "type",
  "name",
  "internal",
  "provider",
  "contact",
  "phone",
  "email",
  "address",
  "qualification",
  "hours",
];
const staffHeaders = [
  "Begleitungs-ID",
  "Typ",
  "Name / Bezeichnung",
  "Intern / extern",
  "Träger / Arbeitgeber",
  "Ansprechperson",
  "Telefon",
  "E-Mail",
  "Anschrift",
  "Qualifikation",
  "Std. / Woche",
  "Aktive Fälle",
  "Datenhinweis",
  "Notizen",
  "Auswahleintrag (automatisch)",
  "Archiviert am",
];
function value(cell) {
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("formula" in v || "sharedFormula" in v) return v.result ?? "";
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text) return v.text;
    if (v.error) throw Error(`Excel-Fehler in ${cell.address}: ${v.error}`);
  }
  return v;
}
function dateValue(v) {
  if (v === "" || v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number")
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000)
      .toISOString()
      .slice(0, 10);
  const s = String(v).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s.split(".").reverse().join("-");
  if (validDate(s)) return s;
  throw Error(`Ungültiges Datum: ${s}`);
}
function sheetRows(w, name, first) {
  const sh = w.getWorksheet(name);
  if (!sh) throw Error(`Reiter „${name}“ fehlt.`);
  let row = 0;
  for (let r = 1; r <= Math.min(sh.rowCount, 20); r++)
    if (value(sh.getCell(r, 1)) === first) {
      row = r;
      break;
    }
  if (!row) throw Error(`Spaltenüberschriften in „${name}“ nicht gefunden.`);
  const headers = [];
  sh.getRow(row).eachCell((c, n) => (headers[n] = String(value(c))));
  const rows = [];
  for (let r = row + 1; r <= sh.rowCount; r++) {
    const data = {};
    headers.forEach((h, n) => {
      data[h] = value(sh.getCell(r, n));
    });
    if (data[first] || data.Fallname || data["Name / Bezeichnung"])
      rows.push({ row: r, data });
  }
  return { headers, rows };
}
export async function readWorkbook(path) {
  // Some valid OOXML producers prefix the spreadsheet namespace. ExcelJS expects
  // unprefixed element names. Normalize only that namespace, retaining r:id etc.
  const zip = await JSZip.loadAsync(await readFile(path));
  let bytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.endsWith(".xml")) continue;
    let xml = await entry.async("string");
    bytes += Buffer.byteLength(xml);
    if (bytes > 100 * 1024 * 1024)
      throw Error("Die entpackte Arbeitsmappe ist zu groß.");
    const match = xml.match(
      /xmlns:([A-Za-z_][\w.-]*)="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/,
    );
    if (match) {
      const prefix = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      xml = xml
        .replace(new RegExp(`(<\\/?)${prefix}:`, "g"), "$1")
        .replaceAll(
          `xmlns:${match[1]}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`,
          'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        );
      zip.file(entry.name, xml);
    }
  }
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(await zip.generateAsync({ type: "nodebuffer" }), {
    ignoreNodes: ["tableParts", "drawing", "extLst"],
  });
  const s = emptyState();
  const notes = [];
  const masterSheet = w.getWorksheet("Auswertung");
  if (masterSheet && value(masterSheet.getCell("D26")) === "Stammdatentyp") {
    for (let row = 27; row <= masterSheet.rowCount; row++) {
      const type = value(masterSheet.getCell(row, 4));
      if (!type) continue;
      if (!["Schule", "Kommune"].includes(type))
        throw Error(`Unbekannter Stammdatentyp in Zeile ${row}.`);
      const entry = {
        id: String(value(masterSheet.getCell(row, 5))),
        name: String(value(masterSheet.getCell(row, 6))),
      };
      if (type === "Schule")
        entry.municipalityId = String(value(masterSheet.getCell(row, 7)));
      const archived = value(masterSheet.getCell(row, 8));
      if (archived) entry.archivedAt = String(archived);
      s[type === "Schule" ? "schools" : "municipalities"].push(entry);
    }
  }
  const staff = sheetRows(w, "Begleitungen", "Begleitungs-ID");
  for (const { data: d, row } of staff.rows) {
    const x = newStaff();
    staffFields.forEach((k, i) => (x[k] = d[staffHeaders[i]] ?? ""));
    x.notes = String(d.Notizen || "");
    x.hours = Number(x.hours || 0);
    if (d["Archiviert am"]) x.archivedAt = String(d["Archiviert am"]);
    if (!x.id) throw Error(`Begleitungen, Zeile ${row}: ID fehlt.`);
    s.staff.push(x);
  }
  const cases = sheetRows(w, "Fälle", "Fall-ID");
  for (const required of [
    "Fallname",
    "Fallstatus",
    "Begleitung auswählen",
    "Letzte Rechnung gestellt am",
  ])
    if (!cases.headers.includes(required))
      throw Error(`Spalte „${required}“ fehlt im Reiter Fälle.`);
  const getMunicipality = (name) => {
    if (!name) return "";
    let m = s.municipalities.find((x) => normalize(x.name) === normalize(name));
    if (!m) {
      m = { id: randomUUID(), name: String(name).trim() };
      s.municipalities.push(m);
    }
    return m.id;
  };
  for (const { data: d, row } of cases.rows) {
    const c = newCase();
    for (let i = 0; i < caseKeys.length; i++) {
      const k = caseKeys[i];
      if (d[caseHeaders[i]] !== undefined) c[k] = d[caseHeaders[i]];
    }
    c.id = String(c.id || "");
    if (!c.id) throw Error(`Fälle, Zeile ${row}: Fall-ID fehlt.`);
    for (const k of dateKeys) c[k] = dateValue(c[k]);
    c.hours = Number(c.hours || 0);
    c.municipalityId = getMunicipality(d["Zuständige Kommune"]);
    const school = String(d.Schule || "").trim();
    if (school) {
      if (!c.municipalityId)
        throw Error(
          `${c.id}: Bitte in Excel eine Kommune zur Schule ergänzen.`,
        );
      let sc =
        s.schools.find(
          (x) =>
            x.id === d["Schul-ID"] && normalize(x.name) === normalize(school),
        ) ||
        s.schools.find(
          (x) =>
            normalize(x.name) === normalize(school) &&
            x.municipalityId === c.municipalityId,
        );
      if (!sc) {
        sc = {
          id: randomUUID(),
          name: school,
          municipalityId: c.municipalityId,
        };
        s.schools.push(sc);
      }
      c.schoolId = sc.id;
    } else c.schoolId = "";
    const selection = String(d["Begleitung auswählen"] || "").trim();
    const id = selection.match(/\[([^\]]+)\]$/)?.[1] || "";
    if (selection && !id)
      throw Error(
        `${c.id}: Begleitung ohne eindeutige ID. Bitte aus der Auswahlliste wählen.`,
      );
    c.staffId = id;
    c.documents = c.documents || "Nicht geprüft";
    c.report = c.report || "Nicht geprüft";
    s.cases.push(c);
  }
  const settings = w.getWorksheet("Auswertung");
  if (settings) {
    for (let r = 1; r <= Math.min(settings.rowCount, 100); r++) {
      const label = String(value(settings.getCell(r, 1)));
      const key =
        Object.keys(s.settings).find((k) => labels[k] === label) ||
        (label === "Vorlauf Rechnung (Tage)" ? "invoiceInterval" : null);
      if (key) s.settings[key] = Number(value(settings.getCell(r, 2)));
    }
  }
  validateState(s);
  notes.push(
    `${s.schools.length} Schulen und ${s.municipalities.length} Kommunen werden als feste Stammdaten angelegt.`,
  );
  return { state: s, notes };
}
const color = {
  purple: "6563E8",
  navy: "354A63",
  teal: "426B7B",
  gold: "9B713F",
  blue: "576B87",
  green: "2D7A66",
};
function setup(w, name, headers, widths, rows, groups) {
  const s = w.addWorksheet(name, {
    properties: { tabColor: { argb: color.purple } },
    views: [{ state: "frozen", xSplit: 2, ySplit: 7, showGridLines: false }],
  });
  s.columns = headers.map((h, i) => ({ width: widths[i] || 25 }));
  s.mergeCells(1, 1, 1, Math.min(headers.length, 8));
  s.getCell("A1").value = name;
  s.getCell("A1").font = {
    name: "Calibri",
    size: 22,
    bold: true,
    color: { argb: color.navy },
  };
  s.getRow(1).height = 38;
  s.mergeCells(3, 1, 3, Math.min(headers.length, 8));
  s.getCell("A3").value =
    name === "Fallliste"
      ? "Automatische Übersicht · Daten im Reiter Fälle pflegen"
      : name === "Fälle"
        ? "Je Fall eine Zeile · Begleitung aus der Liste auswählen"
        : "Personen und Träger · Verknüpfung über eine stabile ID";
  s.addTable({
    name: name === "Fälle" ? "Faelle" : name,
    ref: "A7",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight1", showRowStripes: false },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows,
  });
  s.getRow(7).height = 34;
  s.getRow(7).eachCell((c) => {
    c.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color.navy },
    };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  for (const [start, end, title, col] of groups) {
    if (end > start) s.mergeCells(6, start, 6, end);
    s.getCell(6, start).value = title;
    s.getCell(6, start).font = { bold: true, color: { argb: col } };
    for (let j = start; j <= end; j++)
      s.getCell(7, j).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: col },
      };
  }
  for (let r = 8; r < rows.length + 8; r++) {
    s.getRow(r).height = 28;
    for (let c = 1; c <= headers.length; c++) {
      const cell = s.getCell(r, c);
      cell.font = { name: "Calibri", size: 11, color: { argb: "24354C" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    }
  }
  s.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:7",
  };
  return s;
}
function excelDate(v) {
  return validDate(v) ? new Date(v + "T00:00:00Z") : null;
}
function serial(v) {
  return validDate(v)
    ? Math.round(
        (Date.parse(v + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000,
      )
    : "";
}
function formula(cell, f, result) {
  cell.value = { formula: f, result: result ?? "" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "F2F4F8" },
  };
}
function dropdown(cell, formulae) {
  cell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [formulae],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Ungültige Auswahl",
    error: "Bitte einen Eintrag aus der Liste wählen.",
  };
}
export async function writeWorkbook(state, path, now = today()) {
  const w = new ExcelJS.Workbook();
  w.creator = "SIO";
  w.created = new Date();
  w.calcProperties.fullCalcOnLoad = true;
  const n = Math.max(200, state.cases.length + 20),
    count = Math.max(100, state.staff.length + 20);
  const sourceRows = Array.from({ length: n }, (_, i) => {
    const c = state.cases[i];
    return c
      ? [
          ...caseKeys.map((k) =>
            dateKeys.includes(k)
              ? excelDate(c[k])
              : k === "staffId"
                ? staffLabel(state.staff.find((s) => s.id === c.staffId))
                : resolve(state, k, c[k]),
          ),
          c.staffId,
          c.schoolId,
        ]
      : Array(24).fill(null);
  });
  const overviewHeaders = [
    "Fall-ID",
    "Fallname",
    "Fallstatus",
    "Nächste Frist",
    "Tage bis Frist",
    "Handlungsbedarf",
    "Was ist fällig?",
    "Person / Träger",
    "Intern / extern",
    "Unterlagenstatus",
    "Schulberichtstatus",
    "Elterngespräch am",
    "Zuständige Kommune",
    "Bewilligung bis",
    "Bedarfsplanung fällig",
    "Letzte Rechnung gestellt am",
    "Rechnungsstellung fällig",
    "Bewilligungsfrist",
    "Bedarfsplanfrist",
    "Rechnungsfrist",
    "Datenhinweis",
  ];
  const o = setup(
    w,
    "Fallliste",
    overviewHeaders,
    [
      15, 28, 16, 18, 15, 20, 58, 34, 18, 22, 22, 20, 25, 20, 22, 24, 24, 20,
      20, 20, 50,
    ],
    Array.from({ length: n }, () => Array(21).fill(null)),
    [
      [1, 3, "Fall", color.navy],
      [4, 7, "Fristen", color.blue],
      [8, 9, "Begleitung", color.purple],
      [10, 12, "Dokumentation", color.teal],
      [13, 13, "Zuständigkeit", color.teal],
      [14, 17, "Termine", color.gold],
      [18, 21, "Prüfung", color.blue],
    ],
  );
  const c = setup(
    w,
    "Fälle",
    [...caseHeaders, "Verknüpfte ID", "Schul-ID"],
    [
      15, 28, 16, 30, 26, 36, 48, 16, 20, 24, 26, 22, 45, 22, 24, 40, 22, 22,
      32, 23, 32, 45, 20,
    ],
    sourceRows,
    [
      [1, 3, "Fall", color.navy],
      [4, 5, "Zuständigkeit", color.teal],
      [6, 6, "Diagnose", color.gold],
      [7, 8, "Begleitung", color.purple],
      [9, 11, "Planung", color.blue],
      [12, 13, "Elterngespräch", color.teal],
      [14, 18, "Unterlagen & Schulbericht", color.gold],
      [19, 22, "Kontakt & Notizen", color.teal],
      [23, 23, "Verknüpfung", color.blue],
    ],
  );
  const b = setup(
    w,
    "Begleitungen",
    staffHeaders,
    [18, 18, 34, 18, 32, 28, 24, 34, 38, 30, 18, 18, 28, 45, 60],
    Array.from({ length: count }, (_, i) => {
      const s = state.staff[i];
      return s
        ? [
            ...staffFields.map((k) => s[k]),
            state.cases.filter(
              (c) => c.staffId === s.id && c.status !== "Beendet",
            ).length,
            "",
            s.notes,
            staffLabel(s),
            s.archivedAt || "",
          ]
        : Array(16).fill(null);
    }),
    [
      [1, 4, "Begleitung", color.purple],
      [5, 9, "Träger & Kontakt", color.teal],
      [10, 15, "Einsatz", color.blue],
    ],
  );
  const a = w.addWorksheet("Auswertung", { views: [{ showGridLines: false }] });
  a.columns = [{ width: 40 }, { width: 25 }];
  a.getCell("D24").value = "Stammdaten";
  ["Stammdatentyp", "ID", "Name", "Kommune-ID", "Archiviert am"].forEach(
    (text, i) => {
      a.getCell(26, i + 4).value = text;
      a.getCell(26, i + 4).font = { bold: true };
      a.getColumn(i + 4).width = i === 2 ? 35 : 26;
    },
  );
  [
    ...state.municipalities.map((x) => [
      "Kommune",
      x.id,
      x.name,
      "",
      x.archivedAt || "",
    ]),
    ...state.schools.map((x) => [
      "Schule",
      x.id,
      x.name,
      x.municipalityId,
      x.archivedAt || "",
    ]),
  ].forEach((row, i) =>
    row.forEach((v, j) => (a.getCell(27 + i, 4 + j).value = v)),
  );
  c.getColumn(24).hidden = true;
  a.getCell("A1").value = "Auswertung";
  a.getCell("A1").font = {
    size: 22,
    bold: true,
    color: { argb: color.purple },
  };
  a.getCell("A4").value = "Stand";
  formula(a.getCell("B4"), "TODAY()", serial(now));
  a.getCell("B4").numFmt = "dd.mm.yyyy";
  for (const [i, k] of Object.keys(state.settings).entries()) {
    a.getCell(i + 6, 1).value = labels[k];
    a.getCell(i + 6, 2).value = state.settings[k];
    a.getCell(i + 6, 2).dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [k === "invoiceInterval" ? 1 : 0, 3650],
      showErrorMessage: true,
      error: "Bitte eine gültige Tageszahl eingeben.",
    };
  }
  a.getCell("A11").value =
    "Nächste Rechnung = letztes Rechnungsdatum + Rechnungsabstand.";
  a.getCell("A13").value = "Status";
  a.getCell("B13").value = "Fälle";
  caseStatus.forEach((status, i) => {
    a.getCell(i + 14, 1).value = status;
    formula(
      a.getCell(i + 14, 2),
      `COUNTIF('Fälle'!C8:C${n + 7},A${i + 14})`,
      state.cases.filter((c) => c.status === status).length,
    );
  });
  a.getCell("A20").value = "Rot: überfällig / heute";
  a.getCell("A20").font = { color: { argb: "B42335" } };
  a.getCell("A21").value = "Gelb: Vorwarnung";
  a.getCell("A21").font = { color: { argb: "9A6500" } };
  a.getCell("A22").value = "Blau: Termin fehlt / prüfen";
  a.getCell("A22").font = { color: { argb: "245CB0" } };
  w.definedNames.add(
    `'Begleitungen'!$O$8:$O$${count + 7}`,
    "Begleitungsauswahl",
  );
  for (let r = 8; r < n + 8; r++) {
    const v = state.cases[r - 8];
    const ov = v ? overview(v, state.settings, now) : null;
    const src = (k) => `'Fälle'!${k}${r}`;
    const blank = `${src("B")}=""`;
    const guard = (f) => `IF(${blank},"",${f})`;
    for (const col of [9, 10, 11, 12, 15, 18])
      c.getCell(r, col).numFmt = "dd.mm.yyyy";
    dropdown(c.getCell(r, 3), `"${caseStatus.join(",")}"`);
    dropdown(c.getCell(r, 14), `"${docStatus.join(",")}"`);
    dropdown(c.getCell(r, 17), `"${reportStatus.join(",")}"`);
    dropdown(c.getCell(r, 7), "Begleitungsauswahl");
    formula(
      c.getCell(r, 23),
      `IF(G${r}="","",IFERROR(MID(G${r},FIND("[",G${r})+1,FIND("]",G${r})-FIND("[",G${r})-1),""))`,
      v?.staffId || "",
    );
    const sourceMap = {
      1: "A",
      2: "B",
      3: "C",
      10: "N",
      11: "Q",
      12: "L",
      13: "E",
      14: "I",
      15: "J",
      16: "K",
    };
    for (const [dest, from] of Object.entries(sourceMap)) {
      const k = Number(dest);
      const raw = sourceRows[r - 8][from.charCodeAt(0) - 65];
      formula(
        o.getCell(r, k),
        guard(`IF(${src(from)}="","",${src(from)})`),
        raw instanceof Date
          ? serial(raw.toISOString().slice(0, 10))
          : (raw ?? ""),
      );
    }
    formula(
      o.getCell(r, 8),
      guard(
        `IF(${src("W")}="","Unbesetzt",IFERROR(VLOOKUP(${src("W")},'Begleitungen'!$A$8:$O$${count + 7},3,FALSE),"ID prüfen"))`,
      ),
      v ? state.staff.find((s) => s.id === v.staffId)?.name || "Unbesetzt" : "",
    );
    formula(
      o.getCell(r, 9),
      guard(
        `IF(${src("W")}="","Unbesetzt",IFERROR(VLOOKUP(${src("W")},'Begleitungen'!$A$8:$O$${count + 7},4,FALSE),"ID prüfen"))`,
      ),
      v
        ? state.staff.find((s) => s.id === v.staffId)?.internal || "Unbesetzt"
        : "",
    );
    formula(
      o.getCell(r, 17),
      guard(`IF(OR(P${r}="",P${r}>TODAY()),"",P${r}+'Auswertung'!$B$8)`),
      serial(ov?.invoiceDue),
    );
    const statusFormula = (col, warning) =>
      `IF(C${r}="Beendet","Beendet",IF(${col}${r}="","Termin fehlt",IF(${col}${r}<TODAY(),"Überfällig",IF(${col}${r}=TODAY(),"Heute fällig",IF(${col}${r}<=TODAY()+${warning},"Bald fällig","Geplant")))))`;
    formula(
      o.getCell(r, 18),
      guard(statusFormula("N", "'Auswertung'!$B$6")),
      ov?.deadlines[0].status,
    );
    formula(
      o.getCell(r, 19),
      guard(statusFormula("O", "'Auswertung'!$B$7")),
      ov?.deadlines[1].status,
    );
    formula(
      o.getCell(r, 20),
      guard(
        `IF(C${r}="Beendet","Beendet",IF(P${r}>TODAY(),"Datum prüfen",${statusFormula("Q", "'Auswertung'!$B$9")}))`,
      ),
      ov?.deadlines[2].status,
    );
    formula(
      o.getCell(r, 4),
      guard(
        `IF(OR(C${r}="Beendet",COUNT(N${r}:O${r},Q${r})=0),"",MIN(N${r}:O${r},Q${r}))`,
      ),
      serial(ov?.next),
    );
    formula(
      o.getCell(r, 5),
      guard(`IF(D${r}="","",D${r}-TODAY())`),
      ov?.days ?? "",
    );
    let overall = '"Geplant"';
    for (const [status, result] of [
      ["Termin fehlt", "Termine ergänzen"],
      ["Datum prüfen", "Datum prüfen"],
      ["Bald fällig", "Bald fällig"],
      ["Heute fällig", "Heute fällig"],
      ["Überfällig", "Überfällig"],
    ])
      overall = `IF(COUNTIF(R${r}:T${r},"${status}")>0,"${result}",${overall})`;
    formula(
      o.getCell(r, 6),
      guard(`IF(C${r}="Beendet","Beendet",${overall})`),
      ov?.status,
    );
    const parts = [
      ["R", "N", "Bewilligung"],
      ["S", "O", "Bedarfsplanung"],
      ["T", "Q", "Rechnungsstellung"],
    ]
      .map(
        ([st, dt, label]) =>
          `IF(OR(${st}${r}="Überfällig",${st}${r}="Heute fällig",${st}${r}="Bald fällig"),"${label}, ",IF(${st}${r}="Termin fehlt","${label} (${st === "T" ? "letztes Datum fehlt" : "Termin fehlt"}), ",IF(${st}${r}="Datum prüfen","${label} (Datum prüfen), ",IF(AND(F${r}="Geplant",${dt}${r}=D${r}),"${label} (nächste Frist), ",""))))`,
      )
      .join("&");
    formula(
      o.getCell(r, 7),
      guard(`IF(C${r}="Beendet","",LEFT(${parts},MAX(0,LEN(${parts})-2)))`),
      ov?.due,
    );
    formula(
      o.getCell(r, 21),
      guard(
        `IF(C${r}="Beendet","",IF(${src("W")}="","Begleitung fehlt; ","")&IF(OR(J${r}="Nicht geprüft",J${r}="Unvollständig"),"Unterlagen prüfen; ","")&IF(OR(K${r}="Nicht geprüft",K${r}="Angefordert"),"Schulbericht prüfen","") )`,
      ),
      v ? warnings(v, state).join("; ") : "",
    );
    for (const col of [4, 12, 14, 15, 16, 17])
      o.getCell(r, col).numFmt = "dd.mm.yyyy";
  }
  for (let r = 8; r < count + 8; r++) {
    const s = state.staff[r - 8];
    formula(
      b.getCell(r, 12),
      `IF(A${r}="","",COUNTIFS('Fälle'!$W$8:$W$${n + 7},A${r},'Fälle'!$C$8:$C$${n + 7},"<>Beendet"))`,
      s
        ? state.cases.filter(
            (c) => c.staffId === s.id && c.status !== "Beendet",
          ).length
        : "",
    );
    formula(
      b.getCell(r, 15),
      `IF(OR(A${r}="",P${r}<>""),"",C${r}&" · "&B${r}&" ["&A${r}&"]")`,
      s && !s.archivedAt ? staffLabel(s) : "",
    );
    dropdown(b.getCell(r, 2), '"Person,Träger"');
    dropdown(b.getCell(r, 4), '"Intern,Extern"');
  }
  const cf = [
    ["Überfällig", "FCE6E7", "B42335"],
    ["Heute fällig", "FCE6E7", "B42335"],
    ["Bald fällig", "FFF1CD", "946200"],
    ["Termine ergänzen", "E6EFFC", "245CB0"],
    ["Datum prüfen", "E6EFFC", "245CB0"],
    ["Geplant", "E7F3EF", "276C56"],
  ];
  for (const [text, bg, fg] of cf)
    o.addConditionalFormatting({
      ref: `D8:G${n + 7}`,
      rules: [
        {
          type: "expression",
          formulae: [`$F8="${text}"`],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: bg } },
            font: { color: { argb: fg } },
          },
        },
      ],
    });
  await w.xlsx.writeFile(path);
  return path;
}
