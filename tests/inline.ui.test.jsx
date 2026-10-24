import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaseDetail } from "../src/CaseDetail.jsx";
import { emptyState, newCase, newStaff, overview } from "../shared/model.mjs";
afterEach(cleanup);
const now = "2026-10-24";
function setup({ unassigned = false } = {}) {
  const state = emptyState();
  state.revision = 2;
  state.staff = [{ ...newStaff(), id: "IB-001", name: "Anna Beispiel" }];
  state.cases = [
    {
      ...newCase(),
      id: "F-001",
      name: "Testfall",
      staffId: "IB-001",
      approvalDate: "2026-10-20",
      planDate: "2026-10-25",
      invoiceDate: "2026-10-24",
    },
  ];
  const c = {
    ...state.cases[0],
    ov: overview(state.cases[0], state.settings, now),
  };
  if (unassigned) {
    c.staffId = "";
    state.cases[0].staffId = "";
  }
  window.sco = {
    dirty: vi.fn(async () => ({ ok: true })),
    history: vi.fn(async () => ({ ok: true, value: [] })),
  };
  const props = {
    c,
    state,
    now,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onSave: vi.fn(async () => {}),
    notify: vi.fn(),
    ask: vi.fn(async () => true),
  };
  render(<CaseDetail {...props} />);
  return props;
}
test("Falldaten werden ohne Dialog validiert und mit Strg+S gespeichert", async () => {
  const user = userEvent.setup();
  const p = setup();
  await user.click(
    screen.getByRole("button", { name: "Falldaten bearbeiten" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.type(
    screen.getByRole("textbox", { name: "Diagnose" }),
    "Testangabe",
  );
  const hours = screen.getByRole("spinbutton", { name: "Std. / Woche" });
  await user.clear(hours);
  await user.type(hours, "200");
  await user.click(screen.getByRole("button", { name: "Falldaten speichern" }));
  expect(screen.getByText("Bitte 0 bis 168 Stunden eingeben.")).toBeTruthy();
  expect(p.onSave).not.toHaveBeenCalled();
  await user.clear(hours);
  await user.type(hours, "22");
  await user.keyboard("{Control>}s{/Control}");
  await waitFor(() => expect(p.onSave).toHaveBeenCalledTimes(1));
  expect(p.onSave.mock.calls[0][1].diagnosis).toBe("Testangabe");
  expect(p.onSave.mock.calls[0][2]).toBe(2);
});
test("Inline-Dokumentation lässt sich abbrechen und schützt einen Tabwechsel", async () => {
  const user = userEvent.setup();
  const p = setup();
  await user.click(screen.getByRole("tab", { name: "Dokumentation" }));
  await user.click(
    screen.getByRole("button", { name: "Elterngespräch bearbeiten" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Gespräch / Ergebnis" }),
    "Notiz",
  );
  p.ask.mockResolvedValueOnce(false);
  await user.click(screen.getByRole("tab", { name: "Kontakt" }));
  expect(
    screen.getByRole("textbox", { name: "Gespräch / Ergebnis" }).value,
  ).toBe("Notiz");
  await user.click(
    screen.getByRole("button", { name: "Elterngespräch abbrechen" }),
  );
  expect(p.onSave).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("textbox", { name: "Gespräch / Ergebnis" }),
  ).toBeNull();
});
test("Begleitungsdaten können inline geändert werden; Hinweis auf gemeinsame Stammdaten bleibt sichtbar", async () => {
  const user = userEvent.setup();
  const p = setup();
  await user.click(
    screen.getByRole("button", { name: "Begleitung bearbeiten" }),
  );
  expect(screen.getByText(/gelten für alle zugeordneten Fälle/)).toBeTruthy();
  await user.type(screen.getByRole("textbox", { name: "Telefon" }), "0000");
  await user.click(
    screen.getByRole("button", { name: "Begleitung speichern" }),
  );
  await waitFor(() =>
    expect(p.onSave).toHaveBeenCalledWith(
      "staff",
      expect.objectContaining({ id: "IB-001", phone: "0000" }),
      2,
    ),
  );
});
test("Fristkarten zeigen lesbare Resttage und Überfälligkeit", () => {
  setup();
  expect(screen.getByText("4 Tage überfällig")).toBeTruthy();
  expect(screen.getByText("Noch 1 Tag")).toBeTruthy();
  expect(screen.getByText("Noch 30 Tage")).toBeTruthy();
});
test("Erste Begleitungszuordnung bietet Abbrechen und Speichern und speichert die Auswahl", async () => {
  const user = userEvent.setup();
  const p = setup({ unassigned: true });
  await user.click(screen.getByRole("button", { name: "Begleitung zuordnen" }));
  expect(
    screen.getByRole("button", { name: "Zuordnung abbrechen" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Zuordnung speichern" }).disabled,
  ).toBe(true);
  await user.click(screen.getByRole("combobox", { name: "Begleitung" }));
  await user.click(
    await screen.findByRole("option", { name: "Anna Beispiel" }),
  );
  await user.click(screen.getByRole("button", { name: "Zuordnung speichern" }));
  await waitFor(() =>
    expect(p.onSave).toHaveBeenCalledWith(
      "cases",
      expect.objectContaining({ staffId: "IB-001" }),
      2,
    ),
  );
});
test.each([
  ["Bewilligung", "Bewilligung bis", "approvalDate"],
  ["Bedarfsplanung", "Bedarfsplanung fällig", "planDate"],
  ["Rechnungsstellung", "Letzte Rechnung gestellt am", "invoiceDate"],
])(
  "%s lässt sich direkt in der Fristkarte bearbeiten",
  async (title, label, key) => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(
      screen.getByRole("button", { name: `${title} bearbeiten` }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, "2026-10-22");
    expect(
      screen.getByRole("button", { name: `${title} abbrechen` }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: `${title} speichern` }),
    );
    await waitFor(() =>
      expect(p.onSave).toHaveBeenCalledWith(
        "cases",
        expect.objectContaining({ [key]: "2026-10-22" }),
        2,
      ),
    );
  },
);
