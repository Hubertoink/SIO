import { emptyState, newCase, newStaff } from "../shared/model.mjs";
export function blueprintFixture() {
  const state = emptyState();
  state.settings.invoiceInterval = 365;
  state.municipalities = [{ id: "M-001", name: "Teststadt" }];
  state.schools = [
    { id: "S-001", name: "Testschule Nord", municipalityId: "M-001" },
  ];
  state.staff = Array.from({ length: 3 }, (_, i) => ({
    ...newStaff(),
    id: `IB-00${i + 1}`,
    name: `Fiktive Begleitung ${i + 1}`,
    type: i === 1 ? "Träger" : "Person",
    internal: i === 0 ? "Intern" : "Extern",
  }));
  state.cases = Array.from({ length: 7 }, (_, i) => ({
    ...newCase(),
    id: `F-00${i + 1}`,
    name: `Fiktiver Testfall ${i + 1}`,
    schoolId: "S-001",
    municipalityId: "M-001",
    staffId: "IB-002",
    approvalDate: "2026-12-31",
    invoiceDate: "2026-10-23",
  }));
  return state;
}
