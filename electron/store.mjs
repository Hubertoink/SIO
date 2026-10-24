import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { withDemoData } from "../shared/demo.mjs";
import {
  emptyState,
  validateRecord,
  validateSettings,
  normalize,
  caseKeys,
  staffKeys,
  resolve,
  labels,
} from "../shared/model.mjs";

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, entity TEXT NOT NULL, at TEXT NOT NULL, action TEXT NOT NULL, changes TEXT NOT NULL)",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO state VALUES(1,0,?)")
      .run(JSON.stringify(emptyState()));
  }
  read() {
    const r = this.db.prepare("SELECT * FROM state WHERE id=1").get();
    return { ...JSON.parse(r.json), revision: r.revision };
  }
  history(id) {
    return this.db
      .prepare(
        "SELECT * FROM audit WHERE entity=? ORDER BY at DESC, rowid DESC",
      )
      .all(id)
      .map((x) => ({ ...x, changes: JSON.parse(x.changes) }));
  }
  allHistory() {
    return this.db
      .prepare("SELECT * FROM audit ORDER BY at DESC, rowid DESC")
      .all()
      .map((x) => ({ ...x, changes: JSON.parse(x.changes) }));
  }
  commit(state, revision, entries = []) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db
        .prepare(
          "UPDATE state SET json=?,revision=revision+1 WHERE id=1 AND revision=?",
        )
        .run(JSON.stringify({ ...state, revision: undefined }), revision);
      if (!result.changes)
        throw Error(
          "Die Daten wurden zwischenzeitlich geändert. Bitte neu laden.",
        );
      for (const e of entries)
        this.db
          .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
          .run(
            randomUUID(),
            e.entity,
            new Date().toISOString(),
            e.action,
            JSON.stringify(e.changes),
          );
      this.db.exec("COMMIT");
      return this.read();
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  save(kind, record, revision) {
    if (!["cases", "staff"].includes(kind)) throw Error("Ungültiger Datentyp.");
    const s = this.read();
    const errors = validateRecord(kind, record, s);
    if (Object.keys(errors).length)
      throw Error(
        Object.entries(errors)
          .map(([k, v]) => `${labels[k] || k}: ${v}`)
          .join("\n"),
      );
    const keys = kind === "cases" ? caseKeys : staffKeys;
    const value = Object.fromEntries(
      keys
        .filter((k) => k !== "id")
        .map((k) => [
          k,
          k === "hours"
            ? Number(record[k] || 0)
            : String(record[k] || "").trim(),
        ]),
    );
    const prefix = kind === "cases" ? "F" : "IB";
    const old = record.id ? s[kind].find((x) => x.id === record.id) : null;
    if (record.id && !old) throw Error("Der Eintrag existiert nicht mehr.");
    if (old?.archivedAt) value.archivedAt = old.archivedAt;
    value.id =
      old?.id ||
      `${prefix}-${String(Math.max(0, ...s[kind].map((x) => Number(x.id.match(/-(\d+)$/)?.[1]) || 0)) + 1).padStart(3, "0")}`;
    const changes = keys
      .filter((k) => k !== "id" && (old?.[k] ?? "") !== value[k])
      .map((k) => ({
        field: labels[k] || k,
        before: resolve(s, k, old?.[k]),
        after: resolve(s, k, value[k]),
      }));
    if (old) s[kind] = s[kind].map((x) => (x.id === value.id ? value : x));
    else s[kind].push(value);
    return {
      state: this.commit(
        s,
        revision,
        changes.length
          ? [
              {
                entity: value.id,
                action: old ? "Geändert" : "Erstellt",
                changes,
              },
              ...(kind === "staff" && old
                ? s.cases
                    .filter((c) => c.staffId === old.id)
                    .map((c) => ({
                      entity: c.id,
                      action: "Begleitung geändert",
                      changes: changes.map((x) => ({
                        ...x,
                        field: `Begleitung · ${x.field}`,
                      })),
                    }))
                : []),
            ]
          : [],
      ),
      id: value.id,
    };
  }
  master(kind, record, revision) {
    if (!["schools", "municipalities"].includes(kind))
      throw Error("Ungültige Stammdaten.");
    const s = this.read();
    const name = String(record.name || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!name || name.length > 200)
      throw Error("Bitte einen Namen mit maximal 200 Zeichen eingeben.");
    if (
      s[kind].some(
        (x) =>
          x.id !== record.id &&
          normalize(x.name) === normalize(name) &&
          (kind !== "schools" || x.municipalityId === record.municipalityId),
      )
    )
      throw Error(
        "Dieser Eintrag existiert bereits. Bitte den vorhandenen Eintrag verwenden.",
      );
    if (
      kind === "schools" &&
      !s.municipalities.some((x) => x.id === record.municipalityId)
    )
      throw Error("Bitte die Kommune der Schule auswählen.");
    const old = record.id ? s[kind].find((x) => x.id === record.id) : null;
    if (record.id && !old) throw Error("Eintrag nicht gefunden.");
    const value = {
      id: old?.id || randomUUID(),
      name,
      ...(old?.archivedAt ? { archivedAt: old.archivedAt } : {}),
      ...(kind === "schools" ? { municipalityId: record.municipalityId } : {}),
    };
    s[kind] = old
      ? s[kind].map((x) => (x.id === old.id ? value : x))
      : [...s[kind], value];
    return {
      state: this.commit(s, revision, [
        {
          entity: value.id,
          action: old ? "Stammdaten geändert" : "Stammdaten erstellt",
          changes: [{ field: "Name", before: old?.name || "", after: name }],
        },
      ]),
      id: value.id,
    };
  }
  settings(settings, revision) {
    const errors = validateSettings(settings);
    if (Object.keys(errors).length)
      throw Error(Object.values(errors).join("\n"));
    const s = this.read();
    const changes = Object.keys(settings)
      .filter((k) => s.settings[k] !== settings[k])
      .map((k) => ({
        field: labels[k],
        before: s.settings[k],
        after: settings[k],
      }));
    s.settings = settings;
    return this.commit(
      s,
      revision,
      changes.length
        ? [{ entity: "settings", action: "Einstellungen geändert", changes }]
        : [],
    );
  }
  archive(kind, id, archived, revision) {
    if (!["schools", "staff"].includes(kind) || typeof archived !== "boolean")
      throw Error("Ungültige Archivaktion.");
    const state = this.read(),
      record = state[kind].find((x) => x.id === id);
    if (!record) throw Error("Eintrag nicht gefunden.");
    if (archived) record.archivedAt = new Date().toISOString();
    else delete record.archivedAt;
    const changes = [
      {
        field: "Archivstatus",
        before: archived ? "Aktiv" : "Archiviert",
        after: archived ? "Archiviert" : "Aktiv",
      },
    ];
    const title = kind === "schools" ? "Schule" : "Begleitung";
    return this.commit(state, revision, [
      {
        entity: id,
        action: archived ? "Archiviert" : "Wieder aktiviert",
        changes,
      },
      ...state.cases
        .filter((c) => c[kind === "schools" ? "schoolId" : "staffId"] === id)
        .map((c) => ({
          entity: c.id,
          action: `${title} ${archived ? "archiviert" : "wieder aktiviert"}`,
          changes: [
            {
              field: title,
              before: record.name,
              after: record.name + (archived ? " (archiviert)" : " (aktiv)"),
            },
          ],
        })),
    ]);
  }
  demo(revision) {
    const state = withDemoData(this.read());
    validateState(state);
    return this.commit(
      state,
      revision,
      state.cases
        .filter((c) => c.id.startsWith("DEMO-"))
        .map((c) => ({
          entity: c.id,
          action: "Demofall erstellt",
          changes: [{ field: "Fall", before: "", after: c.name }],
        })),
    );
  }
  import(data, revision, history) {
    validateState(data);
    const entries = data.cases.map((c) => ({
      entity: c.id,
      action: "Aus Excel übernommen",
      changes: [{ field: "Fall", before: "", after: c.name }],
    }));
    if (history) {
      if (
        !Array.isArray(history) ||
        history.length > 100000 ||
        history.some(
          (x) =>
            typeof x.entity !== "string" ||
            typeof x.action !== "string" ||
            !Array.isArray(x.changes),
        )
      )
        throw Error("Ungültiger Verlauf in der Sicherung.");
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.read();
      if (current.revision !== revision)
        throw Error(
          "Die Daten wurden zwischenzeitlich geändert. Bitte Import neu starten.",
        );
      this.db
        .prepare("UPDATE state SET json=?,revision=revision+1 WHERE id=1")
        .run(JSON.stringify({ ...data, revision: undefined }));
      this.db.exec("DELETE FROM audit");
      for (const e of history || entries)
        this.db
          .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
          .run(
            randomUUID(),
            e.entity,
            e.at || new Date().toISOString(),
            e.action,
            JSON.stringify(e.changes),
          );
      this.db.exec("COMMIT");
      return this.read();
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
export function validateState(s) {
  if (!s || s.version !== 1) throw Error("Unbekanntes Dateiformat.");
  for (const kind of ["cases", "staff", "schools", "municipalities"]) {
    if (!Array.isArray(s[kind]) || s[kind].length > 50000)
      throw Error("Ungültige Datenmenge.");
    const ids = new Set();
    for (const x of s[kind]) {
      if (
        x.archivedAt !== undefined &&
        (typeof x.archivedAt !== "string" ||
          Number.isNaN(Date.parse(x.archivedAt)))
      )
        throw Error("Ungültiger Archivstatus.");
      if (!x.id || typeof x.id !== "string" || ids.has(x.id))
        throw Error(`Doppelte oder fehlende ID: ${x.id}`);
      ids.add(x.id);
      if (["cases", "staff"].includes(kind)) {
        const e = validateRecord(kind, x, s);
        if (Object.keys(e).length)
          throw Error(
            `${x.id}: ${Object.entries(e)
              .map(([k, v]) => `${labels[k]}: ${v}`)
              .join(", ")}`,
          );
      } else if (typeof x.name !== "string" || !x.name.trim())
        throw Error("Ungültige Stammdaten.");
    }
  }
  for (const x of s.schools)
    if (!s.municipalities.some((m) => m.id === x.municipalityId))
      throw Error("Schule ohne gültige Kommune.");
  const errors = validateSettings(s.settings || {});
  if (Object.keys(errors).length) throw Error(Object.values(errors).join("\n"));
}
