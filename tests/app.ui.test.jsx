import React from "react";
import { test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/main.jsx";
import { withDemoData } from "../shared/demo.mjs";
import {
  emptyState,
  newCase,
  newStaff,
  today,
  addDays,
} from "../shared/model.mjs";
let data, history, closeCallback;
const ok = (value) => Promise.resolve({ ok: true, value });
beforeEach(() => {
  location.hash = "dashboard";
  data = { ...emptyState(), revision: 0 };
  history = [];
  data.municipalities = [{ id: "M1", name: "Musterstadt" }];
  data.schools = [
    { id: "S1", name: "Grundschule am Park", municipalityId: "M1" },
  ];
  data.staff = [{ ...newStaff(), id: "IB-001", name: "Anna Beispiel" }];
  data.cases = [
    {
      ...newCase(),
      id: "F-001",
      name: "Testfall",
      schoolId: "S1",
      municipalityId: "M1",
      approvalDate: addDays(today(), -1),
    },
  ];
  window.sco = {
    read: vi.fn(() =>
      ok({
        state: structuredClone(data),
        dataDir: "Testdaten",
        version: "0.1.0",
      }),
    ),
    dirty: vi.fn(() => ok(null)),
    onCloseRequested: vi.fn((callback) => {
      closeCallback = callback;
      return () => {
        closeCallback = null;
      };
    }),
    resolveClose: vi.fn(() => ok(null)),
    archive: vi.fn((kind, id, archived) => {
      const record = data[kind].find((x) => x.id === id);
      if (archived) record.archivedAt = new Date().toISOString();
      else delete record.archivedAt;
      data.revision++;
      return ok(structuredClone(data));
    }),
    demo: vi.fn(() => {
      data = withDemoData(data);
      data.revision++;
      return ok(structuredClone(data));
    }),
    master: vi.fn((kind, record) => {
      const value = {
        ...record,
        id: record.id || (kind === "municipalities" ? "M2" : "S2"),
      };
      data[kind] = [...data[kind].filter((x) => x.id !== value.id), value];
      data.revision++;
      return ok({ state: structuredClone(data), id: value.id });
    }),
    history: vi.fn(() => ok(history)),
    save: vi.fn((kind, draft) => {
      const record = { ...draft, id: draft.id || "F-002" };
      data[kind] = [...data[kind].filter((c) => c.id !== record.id), record];
      data.revision++;
      history = [
        {
          id: "a1",
          entity: record.id,
          at: new Date().toISOString(),
          action: "Geändert",
          changes: [{ field: "Diagnose", before: "", after: "Test" }],
        },
      ];
      return ok({ state: structuredClone(data), id: record.id });
    }),
    settings: vi.fn((s) => {
      data.settings = s;
      data.revision++;
      return ok(structuredClone(data));
    }),
    exportExcel: vi.fn(() => ok("test.xlsx")),
    previewImport: vi.fn(() =>
      ok({
        name: "test.xlsx",
        cases: [{ id: "F-100", name: "Importfall", status: "Neu" }],
        staff: 1,
        notes: [],
        existing: 1,
        settings: data.settings,
      }),
    ),
    applyImport: vi.fn(() => {
      data.cases = [{ ...newCase(), id: "F-100", name: "Importfall" }];
      return ok(structuredClone(data));
    }),
    cancelImport: vi.fn(() => ok(null)),
    backup: vi.fn(() => ok("sicherung.json")),
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test("Schließen mit offenen Eingaben nutzt das Appmodal und erhält beim Abbrechen den Entwurf", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: "Fall anlegen" }));
  await user.type(screen.getByRole("textbox", { name: /Fallname/ }), "Entwurf");
  act(() => closeCallback());
  await screen.findByRole("dialog", { name: "Ungespeicherte Änderungen" });
  await user.click(screen.getByRole("button", { name: "Weiter bearbeiten" }));
  await waitFor(() =>
    expect(window.sco.resolveClose).toHaveBeenCalledWith(false),
  );
  expect((await screen.findByRole("textbox", { name: /Fallname/ })).value).toBe(
    "Entwurf",
  );
  act(() => closeCallback());
  await user.click(
    await screen.findByRole("button", {
      name: "Änderungen verwerfen",
      exact: true,
    }),
  );
  await waitFor(() =>
    expect(window.sco.resolveClose).toHaveBeenCalledWith(true),
  );
  expect(window.sco.save).not.toHaveBeenCalled();
});
test("Begleitungen lassen sich über die Oberfläche archivieren und wieder aktivieren", async () => {
  const user = userEvent.setup();
  data.cases[0].staffId = "IB-001";
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(
    screen.getByRole("button", { name: "Begleitungen", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Begleitung archivieren" }),
  );
  expect(
    await screen.findByText(/1 bestehende Zuordnungen bleiben erhalten/),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Archivieren", exact: true }),
  );
  await waitFor(() => expect(data.staff[0].archivedAt).toBeTruthy());
  expect(data.cases[0].staffId).toBe("IB-001");
  await user.click(await screen.findByRole("tab", { name: "Archiv (1)" }));
  expect(screen.getByRole("heading", { name: "Anna Beispiel" })).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Begleitung wieder aktivieren" }),
  );
  await waitFor(() => expect(data.staff[0].archivedAt).toBeUndefined());
});
test("Entwicklungsbutton ergänzt Demofälle einmalig und erhält vorhandene Fälle", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(
    screen.getByRole("button", { name: "Einstellungen", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Demodaten erstellen" }),
  );
  const done = await screen.findByRole("button", {
    name: "Demodaten vorhanden",
  });
  expect(done.disabled).toBe(true);
  expect(data.cases.length).toBe(7);
  expect(data.cases[0].name).toBe("Testfall");
  expect(window.sco.demo).toHaveBeenCalledTimes(1);
});
test("Schule behält Eingaben beim Anlegen einer Kommune; Enter speichert nur den aktiven Dialog", async () => {
  data.schools = [];
  data.municipalities = [];
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(
    screen.getByRole("button", { name: "Stammdaten", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Schule anlegen", exact: true }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Name" }),
    "Grundschule Beispiel",
  );
  await user.click(
    screen.getByRole("button", { name: "Kommune anlegen", exact: true }),
  );
  const municipality = await screen.findByRole("dialog", {
    name: "Kommune anlegen",
  });
  await user.type(
    within(municipality).getByRole("textbox", { name: "Name" }),
    "Mannheim{Enter}",
  );
  await waitFor(() => expect(window.sco.master).toHaveBeenCalledTimes(1));
  const school = await screen.findByRole("dialog", { name: "Schule anlegen" });
  expect(within(school).getByRole("textbox", { name: "Name" }).value).toBe(
    "Grundschule Beispiel",
  );
  expect(
    within(school).getByRole("combobox", { name: "Ort der Schule" }).value,
  ).toBe("Mannheim");
  await user.click(within(school).getByRole("textbox", { name: "Name" }));
  await user.keyboard("{Enter}");
  await waitFor(() => expect(window.sco.master).toHaveBeenCalledTimes(2));
  expect(data.schools[0].municipalityId).toBe("M2");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
test("Strg+Enter speichert ein großes Fallformular", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: "Fall anlegen" }));
  await user.type(
    screen.getByRole("textbox", { name: /Fallname/ }),
    "Tastaturtest",
  );
  await user.keyboard("{Control>}{Enter}{/Control}");
  await waitFor(() => expect(window.sco.save).toHaveBeenCalledTimes(1));
  expect(data.cases.some((c) => c.name === "Tastaturtest")).toBe(true);
});
test("Dashboard zeigt offene Fristarten und öffnet die passende Fallakte", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  expect(screen.getByText("Überfällig")).toBeTruthy();
  expect(screen.getByText(/Bewilligung, Bedarfsplanung/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Testfall" }));
  await screen.findByRole("heading", { name: "Testfall" });
  await user.click(screen.getByRole("button", { name: "Zur Fallliste" }));
  await screen.findByRole("heading", { name: "Fälle" });
});
test("Neuer Fall validiert Pflichtfeld und zukünftiges Rechnungsdatum, dann speichert er", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: "Fall anlegen" }));
  await user.click(
    screen.getByRole("button", { name: "Speichern", exact: true }),
  );
  expect(
    await screen.findByText("Bitte einen Fallnamen eingeben."),
  ).toBeTruthy();
  await user.type(
    screen.getByRole("textbox", { name: /Fallname/ }),
    "Neuer Testfall",
  );
  await user.click(screen.getByRole("tab", { name: "Fristen", exact: true }));
  const date = screen.getByLabelText("Letzte Rechnung gestellt am");
  await user.type(date, addDays(today(), 1));
  await user.click(
    screen.getByRole("button", { name: "Speichern", exact: true }),
  );
  expect(
    await screen.findByText("Dieses Datum darf nicht in der Zukunft liegen."),
  ).toBeTruthy();
  await user.clear(date);
  await user.type(date, today());
  await user.click(
    screen.getByRole("button", { name: "Speichern", exact: true }),
  );
  await waitFor(() => expect(window.sco.save).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(data.cases.find((c) => c.name === "Neuer Testfall").invoiceDate).toBe(
    today(),
  );
});
test("Formular bietet Schulen als Auswahl und Diagnose vor Begleitung", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: "Fall anlegen" }));
  await user.click(screen.getByRole("combobox", { name: "Schule" }));
  await user.click(
    await screen.findByRole("option", { name: /Grundschule am Park/ }),
  );
  expect(
    screen.getByRole("combobox", { name: "Zuständige Kommune" }).value,
  ).toBe("Musterstadt");
  expect(screen.getByRole("textbox", { name: "Diagnose" })).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Abbrechen", exact: true }),
  );
  await screen.findByText("Änderungen verwerfen?");
  await user.click(
    screen.getByRole("button", { name: "Verwerfen", exact: true }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.sco.save).not.toHaveBeenCalled();
});
test("Ungespeicherte Einstellungen verhindern unbemerkten Navigationsverlust", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(
    screen.getByRole("button", { name: "Einstellungen", exact: true }),
  );
  await screen.findByRole("heading", { name: "Einstellungen" });
  const field = screen.getByLabelText("Rechnungsabstand (Tage)");
  await user.clear(field);
  await user.type(field, "365");
  await user.click(
    screen.getByRole("button", { name: "Dashboard", exact: true }),
  );
  await screen.findByText("Änderungen verwerfen?");
  await user.click(
    screen.getByRole("button", { name: "Abbrechen", exact: true }),
  );
  expect(
    await screen.findByRole("heading", { name: "Einstellungen" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Einstellungen speichern" }),
  );
  await waitFor(() => expect(window.sco.settings).toHaveBeenCalled());
  expect(data.settings.invoiceInterval).toBe(365);
});
test("Excel-Import schreibt erst nach der sichtbaren Vorschau", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(
    screen.getByRole("button", { name: "Einstellungen", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Excel / Sicherung importieren",
    }),
  );
  await screen.findByText("Import prüfen");
  expect(window.sco.applyImport).not.toHaveBeenCalled();
  expect(screen.getByText("Importfall")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Daten übernehmen" }));
  await screen.findByRole("heading", { name: "Dashboard" });
  expect(data.cases[0].name).toBe("Importfall");
});
test("Begleitungen unterscheiden Person und Träger; Export ist erreichbar", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: "Excel exportieren" }));
  await waitFor(() => expect(window.sco.exportExcel).toHaveBeenCalledTimes(1));
  await user.click(
    screen.getByRole("button", { name: "Begleitungen", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Begleitung hinzufügen" }),
  );
  await user.click(screen.getByRole("combobox", { name: "Typ" }));
  await user.click(await screen.findByRole("option", { name: "Träger" }));
  expect(
    screen.getByRole("textbox", { name: /Name des Trägers/ }),
  ).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Ansprechperson" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Telefon" })).toBeTruthy();
});
