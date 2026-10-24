import { newCase, newStaff, addDays, today } from "./model.mjs";

export function withDemoData(existing, now = today()) {
  if (existing.cases.some((c) => c.id.startsWith("DEMO-")))
    throw Error("Demodaten sind bereits vorhanden.");
  const state = structuredClone(existing);
  const municipalityId = "DEMO-M-001",
    schoolId = "DEMO-S-001";
  if (!state.municipalities.some((m) => m.id === municipalityId))
    state.municipalities.push({ id: municipalityId, name: "Demostadt" });
  if (!state.schools.some((s) => s.id === schoolId))
    state.schools.push({
      id: schoolId,
      name: "Demo-Grundschule",
      municipalityId,
    });
  const staff = [
    {
      ...newStaff(),
      id: "DEMO-IB-001",
      name: "DEMO · Anna Beispiel",
      qualification: "Pädagogische Fachkraft",
      hours: 35,
      email: "anna@example.invalid",
    },
    {
      ...newStaff(),
      id: "DEMO-IB-002",
      name: "DEMO · Begleitungsträger",
      type: "Träger",
      internal: "Extern",
      contact: "Alex Beispiel",
      email: "kontakt@example.invalid",
      hours: 80,
    },
    {
      ...newStaff(),
      id: "DEMO-IB-003",
      name: "DEMO · Tom Muster",
      internal: "Extern",
      provider: "DEMO · Begleitungsträger",
      qualification: "Assistenz",
      hours: 30,
    },
  ];
  for (const s of staff)
    if (!state.staff.some((x) => x.id === s.id)) state.staff.push(s);
  const base = {
    ...newCase(),
    status: "Laufend",
    schoolId,
    municipalityId,
    staffId: staff[0].id,
    approvalDate: addDays(now, state.settings.approvalWarning + 45),
    planDate: addDays(now, state.settings.planWarning + 60),
    invoiceDate: now,
    documents: "Vollständig",
    documentsDate: now,
    report: "Liegt vor",
    reportDate: addDays(now, -10),
    parentDate: addDays(now, -14),
    parentContact: "Familie Beispiel (Demo)",
    email: "familie@example.invalid",
    notes: "Fiktiver Demofall. Keine echten personenbezogenen Daten.",
  };
  const variants = [
    {
      name: "DEMO · Mila – überfällig",
      approvalDate: addDays(now, -4),
      invoiceDate: addDays(now, -state.settings.invoiceInterval - 2),
      documents: "Unvollständig",
      missingDocuments: "Einverständniserklärung (Demo)",
    },
    {
      name: "DEMO · Jonas – bald fällig",
      staffId: staff[1].id,
      approvalDate: addDays(
        now,
        Math.max(1, Math.min(7, state.settings.approvalWarning)),
      ),
      planDate: addDays(
        now,
        Math.max(1, Math.min(5, state.settings.planWarning)),
      ),
      report: "Angefordert",
      reportDate: "",
    },
    {
      name: "DEMO · Lina – Termine offen",
      status: "Neu",
      staffId: "",
      approvalDate: "",
      planDate: "",
      invoiceDate: "",
      documents: "Nicht geprüft",
      documentsDate: "",
      report: "Nicht geprüft",
      reportDate: "",
      parentDate: "",
    },
    {
      name: "DEMO · Noah – heute fällig",
      staffId: staff[1].id,
      invoiceDate: addDays(now, -state.settings.invoiceInterval),
    },
    {
      name: "DEMO · Ella – geplant",
      staffId: staff[2].id,
      diagnosis: "Fiktiver Diagnoseeintrag für den Funktionstest",
      parentNotes: "Beispiel für ein dokumentiertes Elterngespräch.",
    },
    {
      name: "DEMO · Emil – beendet",
      status: "Beendet",
      staffId: staff[2].id,
      approvalDate: addDays(now, -30),
      planDate: addDays(now, -20),
      invoiceDate: addDays(now, -state.settings.invoiceInterval - 15),
    },
  ];
  variants.forEach((v, i) =>
    state.cases.push({
      ...base,
      ...v,
      id: `DEMO-F-${String(i + 1).padStart(3, "0")}`,
    }),
  );
  return state;
}
