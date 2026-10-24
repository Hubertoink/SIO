export const caseStatus = ["Neu", "Laufend", "Ruhend", "Beendet"];
export const docStatus = [
  "Nicht geprüft",
  "Unvollständig",
  "Vollständig",
  "Nicht erforderlich",
];
export const reportStatus = [
  "Nicht geprüft",
  "Angefordert",
  "Liegt vor",
  "Nicht erforderlich",
];
export const defaults = {
  approvalWarning: 30,
  planWarning: 30,
  invoiceInterval: 30,
  invoiceWarning: 3,
};
export const labels = {
  id: "Fall-ID",
  name: "Fallname",
  status: "Fallstatus",
  schoolId: "Schule",
  municipalityId: "Zuständige Kommune",
  diagnosis: "Diagnose",
  staffId: "Begleitung",
  hours: "Std. / Woche",
  approvalDate: "Bewilligung bis",
  planDate: "Bedarfsplanung fällig",
  invoiceDate: "Letzte Rechnung gestellt am",
  parentDate: "Elterngespräch am",
  parentNotes: "Gespräch / Ergebnis",
  documents: "Unterlagenstatus",
  documentsDate: "Unterlagen geprüft am",
  missingDocuments: "Fehlende Unterlagen",
  report: "Schulberichtstatus",
  reportDate: "Schulbericht vom",
  parentContact: "Eltern / Kontakt",
  phone: "Telefon",
  email: "E-Mail",
  notes: "Notizen",
  type: "Typ",
  internal: "Intern / extern",
  provider: "Träger / Arbeitgeber",
  contact: "Ansprechperson",
  address: "Anschrift",
  qualification: "Qualifikation",
  approvalWarning: "Vorlauf Bewilligung (Tage)",
  planWarning: "Vorlauf Bedarfsplan (Tage)",
  invoiceInterval: "Rechnungsabstand (Tage)",
  invoiceWarning: "Vorwarnung Rechnung (Tage)",
};
export const caseKeys = [
  "id",
  "name",
  "status",
  "schoolId",
  "municipalityId",
  "diagnosis",
  "staffId",
  "hours",
  "approvalDate",
  "planDate",
  "invoiceDate",
  "parentDate",
  "parentNotes",
  "documents",
  "documentsDate",
  "missingDocuments",
  "report",
  "reportDate",
  "parentContact",
  "phone",
  "email",
  "notes",
];
export const staffKeys = [
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
  "notes",
];
export const dateKeys = [
  "approvalDate",
  "planDate",
  "invoiceDate",
  "parentDate",
  "documentsDate",
  "reportDate",
];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(v) {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= "1900-01-01" &&
    v <= "9999-12-31" &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
  );
}
export function daysBetween(a, b) {
  return Math.round(
    (Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000,
  );
}
export function addDays(date, days) {
  return validDate(date)
    ? new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
        .toISOString()
        .slice(0, 10)
    : "";
}
export function formatDate(value) {
  return validDate(value) ? value.split("-").reverse().join(".") : "–";
}
export function selectable(records, currentId = "") {
  return records.filter(
    (record) => !record.archivedAt || record.id === currentId,
  );
}
export function deadlineDistance(date, status, now = today()) {
  if (["Beendet", "Archiviert"].includes(status) || !validDate(date))
    return null;
  const days = daysBetween(date, now),
    count = Math.abs(days);
  return {
    days,
    direction: days < 0 ? "up" : days > 0 ? "down" : "today",
    text:
      days === 0
        ? "Heute fällig"
        : days < 0
          ? `${count} ${count === 1 ? "Tag" : "Tage"} überfällig`
          : `Noch ${count} ${count === 1 ? "Tag" : "Tage"}`,
  };
}
export function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}
export function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
export function emptyState() {
  return {
    version: 1,
    cases: [],
    staff: [],
    schools: [],
    municipalities: [],
    settings: { ...defaults },
  };
}
export function newCase() {
  return {
    name: "",
    status: "Neu",
    schoolId: "",
    municipalityId: "",
    diagnosis: "",
    staffId: "",
    hours: 20,
    approvalDate: "",
    planDate: "",
    invoiceDate: "",
    parentDate: "",
    parentNotes: "",
    documents: "Nicht geprüft",
    documentsDate: "",
    missingDocuments: "",
    report: "Nicht geprüft",
    reportDate: "",
    parentContact: "",
    phone: "",
    email: "",
    notes: "",
  };
}
export function newStaff() {
  return {
    name: "",
    type: "Person",
    internal: "Intern",
    provider: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    qualification: "",
    hours: 0,
    notes: "",
  };
}
export function staffLabel(s) {
  return s ? `${s.name} · ${s.type} [${s.id}]` : "";
}
export function resolve(state, key, value) {
  if (key === "schoolId")
    return state.schools.find((x) => x.id === value)?.name || "";
  if (key === "municipalityId")
    return state.municipalities.find((x) => x.id === value)?.name || "";
  if (key === "staffId")
    return state.staff.find((x) => x.id === value)?.name || "";
  return value ?? "";
}
export function validateRecord(kind, record, state, now = today()) {
  const errors = {};
  const keys = kind === "cases" ? caseKeys : staffKeys;
  for (const k of keys) {
    if (k === "hours") continue;
    if (record[k] != null && typeof record[k] !== "string")
      errors[k] = "Bitte Text eingeben.";
    else if (String(record[k] || "").length > 10000)
      errors[k] = "Maximal 10.000 Zeichen.";
  }
  if (!record.name?.trim())
    errors.name =
      kind === "cases"
        ? "Bitte einen Fallnamen eingeben."
        : "Bitte einen Namen eingeben.";
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))
    errors.email = "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (
    !Number.isFinite(Number(record.hours)) ||
    Number(record.hours) < 0 ||
    Number(record.hours) > 168
  )
    errors.hours = "Bitte 0 bis 168 Stunden eingeben.";
  if (kind === "cases") {
    if (!caseStatus.includes(record.status))
      errors.status = "Bitte einen Fallstatus auswählen.";
    if (!docStatus.includes(record.documents))
      errors.documents = "Bitte einen Unterlagenstatus auswählen.";
    if (!reportStatus.includes(record.report))
      errors.report = "Bitte einen Schulberichtstatus auswählen.";
    for (const k of dateKeys) {
      if (record[k] && !validDate(record[k]))
        errors[k] = "Bitte ein gültiges Datum eingeben.";
    }
    for (const k of [
      "invoiceDate",
      "parentDate",
      "documentsDate",
      "reportDate",
    ])
      if (validDate(record[k]) && record[k] > now)
        errors[k] = "Dieses Datum darf nicht in der Zukunft liegen.";
    for (const [key, list] of [
      ["staffId", state.staff],
      ["schoolId", state.schools],
      ["municipalityId", state.municipalities],
    ])
      if (record[key] && !list.some((x) => x.id === record[key]))
        errors[key] = "Der ausgewählte Eintrag existiert nicht mehr.";
    const previous = state.cases.find((c) => c.id === record.id);
    for (const [key, list] of [
      ["schoolId", state.schools],
      ["staffId", state.staff],
    ])
      if (
        list.find((x) => x.id === record[key])?.archivedAt &&
        previous?.[key] !== record[key]
      )
        errors[key] =
          "Dieser Eintrag ist archiviert. Bitte einen aktiven Eintrag wählen.";
  } else {
    if (!["Person", "Träger"].includes(record.type))
      errors.type = "Bitte Person oder Träger auswählen.";
    if (!["Intern", "Extern"].includes(record.internal))
      errors.internal = "Bitte Intern oder Extern auswählen.";
  }
  return errors;
}
export function validateSettings(s) {
  const errors = {};
  for (const k of Object.keys(defaults))
    if (
      !Number.isInteger(s[k]) ||
      s[k] < (k === "invoiceInterval" ? 1 : 0) ||
      s[k] > 3650
    )
      errors[k] =
        `Bitte eine ganze Zahl von ${k === "invoiceInterval" ? 1 : 0} bis 3650 eingeben.`;
  return errors;
}
export function deadlineStatus(date, warning, now = today()) {
  if (!date) return "Termin fehlt";
  if (!validDate(date)) return "Datum prüfen";
  const d = daysBetween(date, now);
  return d < 0
    ? "Überfällig"
    : d === 0
      ? "Heute fällig"
      : d <= warning
        ? "Bald fällig"
        : "Geplant";
}
export const urgencyRank = {
  Überfällig: 0,
  "Heute fällig": 1,
  "Bald fällig": 2,
  "Datum prüfen": 3,
  "Termine ergänzen": 4,
  "Termin fehlt": 4,
  Geplant: 5,
  Beendet: 6,
  Archiviert: 7,
};
export function tone(status) {
  return ["Überfällig", "Heute fällig"].includes(status)
    ? "red"
    : status === "Bald fällig"
      ? "amber"
      : [
            "Termin fehlt",
            "Termine ergänzen",
            "Datum fehlt",
            "Datum prüfen",
          ].includes(status)
        ? "blue"
        : status === "Geplant"
          ? "green"
          : "neutral";
}
export function overview(c, settings, now = today()) {
  const ended = c.status === "Beendet" || !!c.archivedAt;
  const badInvoice =
    !!c.invoiceDate && (!validDate(c.invoiceDate) || c.invoiceDate > now);
  const invoiceDue = badInvoice
    ? ""
    : addDays(c.invoiceDate, settings.invoiceInterval);
  const deadlines = [
    {
      key: "approval",
      label: "Bewilligung",
      date: c.approvalDate,
      warning: settings.approvalWarning,
    },
    {
      key: "plan",
      label: "Bedarfsplanung",
      date: c.planDate,
      warning: settings.planWarning,
    },
    {
      key: "invoice",
      label: "Rechnungsstellung",
      date: invoiceDue,
      warning: settings.invoiceWarning,
    },
  ].map((d) => ({
    ...d,
    status: ended
      ? c.archivedAt
        ? "Archiviert"
        : "Beendet"
      : d.key === "invoice" && badInvoice
        ? "Datum prüfen"
        : deadlineStatus(d.date, d.warning, now),
  }));
  const next = ended
    ? ""
    : deadlines
        .map((d) => d.date)
        .filter(validDate)
        .sort()[0] || "";
  let status = ended
    ? c.archivedAt
      ? "Archiviert"
      : "Beendet"
    : deadlines
        .map((d) => d.status)
        .sort((a, b) => urgencyRank[a] - urgencyRank[b])[0];
  if (status === "Termin fehlt") status = "Termine ergänzen";
  let actionable = ended ? [] : deadlines.filter((d) => d.status !== "Geplant");
  let due = actionable.map(
    (d) =>
      d.label +
      (d.status === "Termin fehlt"
        ? d.key === "invoice"
          ? " (letztes Datum fehlt)"
          : " (Termin fehlt)"
        : d.status === "Datum prüfen"
          ? " (Datum prüfen)"
          : ""),
  );
  if (!ended && !due.length && next)
    due = deadlines
      .filter((d) => d.date === next)
      .map((d) => d.label + " (nächste Frist)");
  return {
    deadlines,
    next,
    days: next ? daysBetween(next, now) : null,
    status,
    due: due.join(", "),
    invoiceDue,
  };
}
export function warnings(c, state) {
  const a = [];
  if (c.status === "Beendet" || c.archivedAt) return a;
  if (!c.staffId) a.push("Begleitung fehlt");
  if (!c.schoolId) a.push("Schule fehlt");
  if (!c.municipalityId) a.push("Kommune fehlt");
  if (["Nicht geprüft", "Unvollständig"].includes(c.documents))
    a.push("Unterlagen " + c.documents.toLowerCase());
  if (["Nicht geprüft", "Angefordert"].includes(c.report))
    a.push("Schulbericht " + c.report.toLowerCase());
  return a;
}
