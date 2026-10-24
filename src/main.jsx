import {
  api,
  dirtySources,
  useDirty,
  Badge,
  Empty,
  Field,
  Section,
} from "./ui.jsx";
import { CaseDetail } from "./CaseDetail.jsx";
import { selectable } from "../shared/model.mjs";
import { Archive, ArchiveRestore } from "lucide-react";
import sioLogo from "../assets/SIO_Logo.png";
import React, { useState, useEffect, useMemo, useId } from "react";
import { createRoot } from "react-dom/client";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Button,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  InputAdornment,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  School,
  Settings,
  Plus,
  Download,
  Upload,
  Save,
  Search,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  CalendarDays,
  TriangleAlert,
  FileCheck,
  UserRound,
  Building2,
  Phone,
  Mail,
  Pencil,
  X,
  Check,
  ArrowUpDown,
  HardDrive,
  Database,
  ShieldCheck,
  History,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import {
  caseStatus,
  docStatus,
  reportStatus,
  labels,
  newCase,
  newStaff,
  validateRecord,
  validateSettings,
  overview,
  tone,
  today,
  formatDate,
  staffLabel,
  resolve,
  warnings,
  urgencyRank,
  similarity,
} from "../shared/model.mjs";
import "./style.css";
import { saveShortcut } from "./shortcuts.mjs";

const theme = createTheme({
  palette: {
    primary: { main: "#6063f7" },
    background: { default: "#eef1ff", paper: "#fff" },
    text: { primary: "#20283a", secondary: "#6d768a" },
  },
  typography: {
    fontFamily: '"Segoe UI", Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiModal: { defaultProps: { disableScrollLock: true } },
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    MuiDialogContent: {
      styleOverrides: { root: { scrollbarGutter: "stable" } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 39, paddingInline: 17 },
      },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 11 } } },
    MuiDialog: {
      defaultProps: { disableScrollLock: true },
      styleOverrides: {
        paper: {
          border: "1px solid #e0e2ee",
          boxShadow: "0 22px 90px #252a4a22",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, minHeight: 48 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { backgroundColor: "#fff", borderRadius: 10 } },
    },
  },
});
const icons = {
  dashboard: LayoutDashboard,
  cases: FolderOpen,
  staff: Users,
  masters: School,
  settings: Settings,
};
const nav = [
  ["dashboard", "Dashboard"],
  ["cases", "Fälle"],
  ["staff", "Begleitungen"],
  ["masters", "Stammdaten"],
  ["settings", "Einstellungen"],
];
export function App() {
  const [state, setState] = useState(null),
    [meta, setMeta] = useState({}),
    [loadError, setLoadError] = useState(""),
    [hasDraft, setHasDraft] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard"),
    [toast, setToast] = useState(null),
    [editor, setEditor] = useState(null),
    [master, setMaster] = useState(null),
    [question, setQuestion] = useState(null),
    [destruction, setDestruction] = useState(null),
    [confirmation, setConfirmation] = useState(""),
    [importInfo, setImportInfo] = useState(null),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(today());
  const [caseQuery, setCaseQuery] = useState(""),
    [filter, setFilter] = useState("Alle"),
    [statusFilter, setStatusFilter] = useState("Aktive"),
    [municipalityFilter, setMunicipalityFilter] = useState(""),
    [sort, setSort] = useState("urgency"),
    [direction, setDirection] = useState(1);
  useEffect(() => {
    api("read")
      .then((r) => {
        setState(r.state);
        setMeta(r);
      })
      .catch((e) => setLoadError(e.message));
    let reverting = false;
    const change = async (event) => {
      if (reverting) {
        reverting = false;
        return;
      }
      if (
        [...dirtySources.values()].some((v) => v.dirty && v.blockNavigation) &&
        !(await ask(
          "Änderungen verwerfen?",
          "Deine Eingaben sind noch nicht gespeichert.",
          "Verwerfen",
        ))
      ) {
        reverting = true;
        location.replace(event.oldURL);
        return;
      }
      setRoute(location.hash.slice(1) || "dashboard");
    };
    const onDirty = () =>
      setHasDraft([...dirtySources.values()].some((v) => v.dirty));
    window.addEventListener("sco-dirty", onDirty);
    window.addEventListener("hashchange", change);
    const unsubscribeClose = window.sco?.onCloseRequested?.(() =>
      setCloseRequested(true),
    );
    const timer = setInterval(() => setNow(today()), 60000);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("sco-dirty", onDirty);
      clearInterval(timer);
      unsubscribeClose?.();
    };
  }, []);
  const go = (r) => {
    if (location.hash.slice(1) === r) setRoute(r);
    else location.hash = r;
  };
  const ask = (title, message, confirm = "Bestätigen") =>
    new Promise((resolve) => setQuestion({ title, message, confirm, resolve }));
  const notify = (text, severity = "success") => setToast({ text, severity });
  const run = async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      notify(e.message, "error");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const saveEditor = async (kind, draft) => {
    const result = await api("save", kind, draft, state.revision);
    setState(result.state);
    setEditor(null);
    notify("Gespeichert");
    return result;
  };
  const openDestruction = (record = null) => {
    setConfirmation("");
    setDestruction({ record, revision: state.revision });
  };
  const destroy = () =>
    run(async () => {
      const result = destruction.record
        ? await api(
            "deleteCase",
            destruction.record.id,
            confirmation,
            destruction.revision,
          )
        : await api("reset", confirmation, destruction.revision);
      setState(result.state);
      setDestruction(null);
      setEditor(null);
      setMaster(null);
      setImportInfo(null);
      go("cases");
      notify(`Daten entfernt. Sicherung: ${result.backupPath}`);
    });
  const archiveRecord = async (kind, record) => {
    const archived = !record.archivedAt;
    const linked = state.cases.filter(
      (c) => c[kind === "schools" ? "schoolId" : "staffId"] === record.id,
    ).length;
    if (
      archived &&
      !(await ask(
        "Eintrag archivieren?",
        kind === "cases"
          ? `${record.name} wird archiviert und aus aktiven Fristen ausgeblendet. Alle Daten bleiben erhalten; der Fall kann wieder aktiviert werden.`
          : `${record.name} wird für neue Zuordnungen ausgeblendet. ${linked ? `${linked} bestehende Zuordnungen bleiben erhalten.` : "Der Eintrag kann später wieder aktiviert werden."}`,
        "Archivieren",
      ))
    )
      return;
    await run(async () => {
      setState(await api("archive", kind, record.id, archived, state.revision));
      notify(archived ? "Eintrag archiviert" : "Eintrag wieder aktiviert");
    });
  };
  const edit = (kind, record, event) =>
    setEditor({
      kind,
      record: record || (kind === "cases" ? newCase() : newStaff()),
      anchor: event?.currentTarget?.getBoundingClientRect(),
    });
  const addMaster = (kind, onSaved, record) =>
    setMaster({
      kind,
      record: record || { name: "", municipalityId: "" },
      onSaved,
    });
  const exportData = () =>
    run(async () => {
      const file = await api("exportExcel");
      if (file) notify("Excel-Datei exportiert");
    });
  const previewImport = () =>
    run(async () => {
      const result = await api("previewImport");
      if (result) setImportInfo(result);
    });
  const backup = () =>
    run(async () => {
      if (await api("backup")) notify("Datensicherung gespeichert");
    });
  const computed = useMemo(
    () =>
      state?.cases.map((c) => ({
        ...c,
        ov: overview(c, state.settings, now),
      })) || [],
    [state, now],
  );
  const active = computed.filter(
    (c) => c.status !== "Beendet" && !c.archivedAt,
  );
  const counts = {
    urgent: active.filter((c) =>
      ["Überfällig", "Heute fällig"].includes(c.ov.status),
    ).length,
    soon: active.filter((c) => c.ov.status === "Bald fällig").length,
    missing: active.filter((c) =>
      c.ov.deadlines.some((d) =>
        ["Termin fehlt", "Datum prüfen"].includes(d.status),
      ),
    ).length,
    documents: active.filter(
      (c) =>
        ["Nicht geprüft", "Unvollständig"].includes(c.documents) ||
        ["Nicht geprüft", "Angefordert"].includes(c.report),
    ).length,
  };
  const activeRoute = route.split("/")[0];
  if (!state)
    return (
      <div className="loading">
        {loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : (
          <>
            <CircularProgress />
            <p>SIO wird geöffnet …</p>
          </>
        )}
      </div>
    );
  const sortCases = (rows) =>
    rows.sort(
      (a, b) =>
        direction *
        (sort === "name"
          ? a.name.localeCompare(b.name, "de")
          : sort === "date"
            ? (a.ov.next || "9999").localeCompare(b.ov.next || "9999")
            : sort === "id"
              ? a.id.localeCompare(b.id, undefined, { numeric: true })
              : urgencyRank[a.ov.status] - urgencyRank[b.ov.status] ||
                (a.ov.next || "9999").localeCompare(b.ov.next || "9999") ||
                a.name.localeCompare(b.name, "de")),
    );
  const visible = sortCases(
    computed.filter(
      (c) =>
        (statusFilter === "Alle" ||
          (statusFilter === "Aktive" &&
            c.status !== "Beendet" &&
            !c.archivedAt) ||
          (c.status === statusFilter && !c.archivedAt) ||
          (statusFilter === "Archiv" && !!c.archivedAt)) &&
        (!municipalityFilter || c.municipalityId === municipalityFilter) &&
        (!caseQuery ||
          [
            c.name,
            c.id,
            resolve(state, "schoolId", c.schoolId),
            resolve(state, "municipalityId", c.municipalityId),
            resolve(state, "staffId", c.staffId),
            c.diagnosis,
          ]
            .join(" ")
            .toLocaleLowerCase("de")
            .includes(caseQuery.toLocaleLowerCase("de"))) &&
        (filter === "Alle" ||
          (filter === "Akut" &&
            ["Überfällig", "Heute fällig"].includes(c.ov.status)) ||
          (filter === "Bald fällig" && c.ov.status === "Bald fällig") ||
          (filter === "Termine fehlen" &&
            c.ov.deadlines.some((d) =>
              ["Termin fehlt", "Datum prüfen"].includes(d.status),
            )) ||
          (filter === "Dokumentation offen" &&
            counts.documents > 0 &&
            (["Nicht geprüft", "Unvollständig"].includes(c.documents) ||
              ["Nicht geprüft", "Angefordert"].includes(c.report))) ||
          (filter === "Unbesetzt" && !c.staffId)),
    ),
  );
  const openFiltered = (f) => {
    setFilter(f);
    setStatusFilter("Aktive");
    setCaseQuery("");
    setMunicipalityFilter("");
    go("cases");
  };
  const caseTable = (rows) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <button
                className="sort"
                onClick={() => {
                  setSort("name");
                  setDirection(sort === "name" ? -direction : 1);
                }}
              >
                Fall <ArrowUpDown size={13} />
              </button>
            </th>
            <th>Handlungsbedarf</th>
            <th>Was ist fällig?</th>
            <th>
              <button
                className="sort"
                onClick={() => {
                  setSort("date");
                  setDirection(sort === "date" ? -direction : 1);
                }}
              >
                Nächste Frist <ArrowUpDown size={13} />
              </button>
            </th>
            <th>Begleitung</th>
            <th>Unterlagen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              onClick={() => go("cases/" + encodeURIComponent(c.id))}
            >
              <td>
                <button
                  className="row-link"
                  onClick={() => go("cases/" + encodeURIComponent(c.id))}
                >
                  {c.name}
                </button>
                <small>
                  {c.id} ·{" "}
                  {resolve(state, "schoolId", c.schoolId) || "Schule offen"}
                </small>
              </td>
              <td>
                <Badge value={c.ov.status} />
              </td>
              <td className="due-cell">{c.ov.due || "–"}</td>
              <td>
                <strong>{formatDate(c.ov.next)}</strong>
                {c.ov.days !== null && (
                  <small className={tone(c.ov.status)}>
                    {c.ov.days < 0
                      ? `${Math.abs(c.ov.days)} Tage überfällig`
                      : c.ov.days === 0
                        ? "Heute"
                        : `in ${c.ov.days} Tagen`}
                  </small>
                )}
              </td>
              <td>
                {resolve(state, "staffId", c.staffId) || (
                  <span className="muted">Unbesetzt</span>
                )}
              </td>
              <td>
                <Badge
                  value={c.documents}
                  kind={
                    c.documents === "Vollständig"
                      ? "green"
                      : c.documents === "Nicht erforderlich"
                        ? "neutral"
                        : "amber"
                  }
                />
              </td>
              <td>
                <ChevronRight size={17} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty
          title="Keine passenden Fälle"
          text="Passe die Filter an oder lege einen neuen Fall an."
        />
      )}
    </div>
  );
  const detailId = route.startsWith("cases/")
    ? decodeURIComponent(route.slice(6))
    : null;
  const detail = detailId ? computed.find((c) => c.id === detailId) : null;
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src={sioLogo} alt="SIO Logo" />
          <strong>SIO</strong>
          <span className="brand-divider" />
          <span>Fallkoordination</span>
        </div>
        <div className="header-right">
          <Tooltip
            title={
              hasDraft
                ? "Ungespeicherte Eingaben"
                : "Alle Änderungen sind lokal gespeichert"
            }
          >
            <span className={hasDraft ? "save-state pending" : "save-state"}>
              <Save size={18} />
            </span>
          </Tooltip>
          <span>
            {new Intl.DateTimeFormat("de-DE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(now + "T12:00:00"))}
          </span>
        </div>
      </header>
      <nav className="navigation" aria-label="Hauptnavigation">
        {nav.map(([key, title]) => {
          const Icon = icons[key];
          return (
            <button
              key={key}
              className={activeRoute === key ? "active" : ""}
              onClick={() => go(key)}
            >
              <Icon size={19} />
              {title}
            </button>
          );
        })}
      </nav>
      <main>
        {activeRoute === "dashboard" && (
          <>
            <div className="page-heading">
              <div>
                <h1>Dashboard</h1>
                <span className="muted">{active.length} aktive Fälle</span>
              </div>
              <div className="actions">
                <Button
                  startIcon={<Download size={17} />}
                  variant="outlined"
                  onClick={exportData}
                  disabled={busy}
                >
                  Excel exportieren
                </Button>
                <Button
                  startIcon={<Plus size={18} />}
                  variant="contained"
                  onClick={(e) => edit("cases", null, e)}
                >
                  Fall anlegen
                </Button>
              </div>
            </div>
            {!state.cases.length ? (
              <Section title="Mit deinen Fällen starten">
                <Empty
                  title="Deine Übersicht ist bereit"
                  text="Übernimm deine Excel-Arbeitsmappe oder lege den ersten Fall an."
                  action={
                    <div className="actions">
                      <Button
                        variant="outlined"
                        startIcon={<Upload size={17} />}
                        onClick={previewImport}
                      >
                        Excel importieren
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Plus size={17} />}
                        onClick={(e) => edit("cases", null, e)}
                      >
                        Fall anlegen
                      </Button>
                    </div>
                  }
                />
              </Section>
            ) : (
              <>
                <div className="kpis">
                  {[
                    [
                      "Jetzt fällig",
                      counts.urgent,
                      "Akut",
                      TriangleAlert,
                      "red",
                    ],
                    ["Bald fällig", counts.soon, "Bald fällig", Clock, "amber"],
                    [
                      "Termine ergänzen",
                      counts.missing,
                      "Termine fehlen",
                      CalendarDays,
                      "blue",
                    ],
                    [
                      "Dokumentation offen",
                      counts.documents,
                      "Dokumentation offen",
                      FileCheck,
                      "purple",
                    ],
                  ].map(([label, count, f, Icon, color]) => (
                    <button
                      className={"kpi " + color}
                      key={label}
                      onClick={() => openFiltered(f)}
                    >
                      <div className="kpi-top">
                        <span>{label}</span>
                        <Icon size={21} />
                      </div>
                      <strong>{count}</strong>
                      <span className="kpi-bottom">
                        {count === 1 ? "Fall ansehen" : "Fälle ansehen"}
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
                <Section
                  title="Fristen im Blick"
                  action={
                    <Button
                      endIcon={<ArrowRight size={16} />}
                      onClick={() => openFiltered("Alle")}
                    >
                      Alle Fälle
                    </Button>
                  }
                >
                  {caseTable(
                    [...active]
                      .sort(
                        (a, b) =>
                          urgencyRank[a.ov.status] - urgencyRank[b.ov.status] ||
                          (a.ov.next || "9999").localeCompare(
                            b.ov.next || "9999",
                          ),
                      )
                      .slice(0, 8),
                  )}
                </Section>
                <div className="dashboard-bottom">
                  <Section title="Nächste 30 Tage">
                    <div className="deadline-bars">
                      {[
                        ["Bewilligung", "approval", "purple"],
                        ["Bedarfsplanung", "plan", "teal"],
                        ["Rechnungsstellung", "invoice", "orange"],
                      ].map(([label, key, color]) => {
                        const total = active
                          .flatMap((c) => c.ov.deadlines)
                          .filter(
                            (d) =>
                              d.key === key &&
                              d.date &&
                              d.date >= now &&
                              new Date(d.date) - new Date(now) <= 30 * 86400000,
                          ).length;
                        return (
                          <div key={key}>
                            <div className="bar-label">
                              <span>{label}</span>
                              <strong>{total}</strong>
                            </div>
                            <div className="bar-track">
                              <div
                                className={"bar " + color}
                                style={{
                                  width: total
                                    ? Math.max(
                                        5,
                                        (total / Math.max(active.length, 1)) *
                                          100,
                                      ) + "%"
                                    : "0%",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                  <Section
                    title="Begleitung zuordnen"
                    action={
                      <Badge
                        value={`${active.filter((c) => !c.staffId).length} unbesetzt`}
                        kind="purple"
                      />
                    }
                  >
                    {active.filter((c) => !c.staffId).length ? (
                      active
                        .filter((c) => !c.staffId)
                        .slice(0, 4)
                        .map((c) => (
                          <button
                            className="simple-row"
                            key={c.id}
                            onClick={() => go("cases/" + c.id)}
                          >
                            <span>
                              <strong>{c.name}</strong>
                              <small>
                                {resolve(state, "schoolId", c.schoolId) ||
                                  "Schule offen"}
                              </small>
                            </span>
                            <ArrowRight size={17} />
                          </button>
                        ))
                    ) : (
                      <div className="all-done">
                        <Check size={24} />
                        <span>Alle aktiven Fälle sind zugeordnet.</span>
                      </div>
                    )}
                  </Section>
                </div>
              </>
            )}
          </>
        )}
        {activeRoute === "cases" && !detailId && (
          <>
            <div className="page-heading">
              <div>
                <h1>Fälle</h1>
                <span className="muted">
                  {visible.length} von {state.cases.length} Fällen
                </span>
              </div>
              <div className="actions">
                <Tooltip title="Excel importieren">
                  <IconButton
                    className="icon-box"
                    onClick={previewImport}
                    disabled={busy}
                  >
                    <Upload size={19} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Excel exportieren">
                  <IconButton
                    className="icon-box"
                    onClick={exportData}
                    disabled={busy}
                  >
                    <Download size={19} />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<Plus size={18} />}
                  onClick={(e) => edit("cases", null, e)}
                >
                  Fall anlegen
                </Button>
              </div>
            </div>
            <div className="filterbar">
              <TextField
                placeholder="Fall, Schule, Begleitung suchen …"
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                select
                label="Fallstatus"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {["Aktive", "Alle", "Archiv", ...caseStatus].map((v) => (
                  <MenuItem value={v} key={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Handlungsbedarf"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "Alle",
                  "Akut",
                  "Bald fällig",
                  "Termine fehlen",
                  "Dokumentation offen",
                  "Unbesetzt",
                ].map((v) => (
                  <MenuItem value={v} key={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Kommune"
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
              >
                <MenuItem value="">Alle Kommunen</MenuItem>
                {state.municipalities.map((m) => (
                  <MenuItem value={m.id} key={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>
              <Tooltip title="Filter zurücksetzen">
                <IconButton
                  onClick={() => {
                    setCaseQuery("");
                    setFilter("Alle");
                    setStatusFilter("Aktive");
                    setMunicipalityFilter("");
                    setSort("urgency");
                    setDirection(1);
                  }}
                >
                  <X size={18} />
                </IconButton>
              </Tooltip>
            </div>
            <div className="panel">{caseTable(visible)}</div>
          </>
        )}
        {detailId &&
          (detail ? (
            <CaseDetail
              key={detail.id}
              c={detail}
              state={state}
              onArchive={() => archiveRecord("cases", detail)}
              onDelete={() => openDestruction(detail)}
              onBack={() => go("cases")}
              onEdit={(e) => edit("cases", detail, e)}
              notify={notify}
              now={now}
              ask={ask}
              onSave={async (kind, record, revision) => {
                const result = await api("save", kind, record, revision);
                setState(result.state);
                notify("Gespeichert");
              }}
            />
          ) : (
            <Empty
              title="Fall nicht gefunden"
              action={
                <Button onClick={() => go("cases")}>Zur Fallliste</Button>
              }
            />
          ))}
        {activeRoute === "staff" && (
          <StaffPage
            state={state}
            edit={edit}
            go={go}
            onArchive={archiveRecord}
          />
        )}
        {activeRoute === "masters" && (
          <MasterPage
            state={state}
            addMaster={addMaster}
            onArchive={archiveRecord}
          />
        )}
        {activeRoute === "settings" && (
          <SettingsPage
            state={state}
            meta={meta}
            setState={setState}
            notify={notify}
            ask={ask}
            exportData={exportData}
            previewImport={previewImport}
            backup={backup}
            onReset={() => openDestruction()}
            busy={busy}
          />
        )}
      </main>
      {editor && (
        <Editor
          key={editor.kind + editor.record.id}
          {...editor}
          state={state}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
          ask={ask}
          notify={notify}
          addMaster={addMaster}
          addStaff={(onSaved) => setMaster({ kind: "staff", onSaved })}
        />
      )}
      {master &&
        (master.kind === "staff" ? (
          <Editor
            kind="staff"
            record={newStaff()}
            state={state}
            onSave={async (kind, draft) => {
              const r = await api("save", kind, draft, state.revision);
              setState(r.state);
              setMaster(null);
              master.onSaved?.(r.id);
              notify("Begleitung angelegt");
            }}
            onClose={() => setMaster(null)}
            ask={ask}
            notify={notify}
            nested
          />
        ) : (
          <MasterEditor
            {...master}
            state={state}
            onCreateMunicipality={async (record) => {
              const r = await api(
                "master",
                "municipalities",
                record,
                state.revision,
              );
              setState(r.state);
              notify("Kommune angelegt");
              return r.id;
            }}
            onSave={async (record) => {
              const r = await api(
                "master",
                master.kind,
                record,
                state.revision,
              );
              setState(r.state);
              setMaster(null);
              master.onSaved?.(r.id);
              notify("Stammdaten gespeichert");
            }}
            onClose={() => setMaster(null)}
            notify={notify}
            ask={ask}
          />
        ))}
      <Dialog
        open={closeRequested}
        maxWidth="xs"
        fullWidth
        onClose={() => {
          setCloseRequested(false);
          api("resolveClose", false).catch((e) => notify(e.message, "error"));
        }}
      >
        <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
        <DialogContent>
          <p>
            Deine Eingaben sind noch nicht gespeichert. Möchtest du die App
            trotzdem schließen?
          </p>
        </DialogContent>
        <DialogActions>
          <Button
            autoFocus
            variant="contained"
            onClick={() => {
              setCloseRequested(false);
              api("resolveClose", false).catch((e) =>
                notify(e.message, "error"),
              );
            }}
          >
            Weiter bearbeiten
          </Button>
          <Button
            onClick={() =>
              api("resolveClose", true).catch((e) => notify(e.message, "error"))
            }
          >
            Änderungen verwerfen
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!destruction}
        onClose={() => !busy && setDestruction(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {destruction?.record
            ? "Fall dauerhaft löschen?"
            : "SIO vollständig zurücksetzen?"}
        </DialogTitle>
        <DialogContent>
          <p>
            {destruction?.record
              ? `Der Fall ${destruction.record.name} samt Verlauf wird entfernt. Schulen und Begleitungen bleiben erhalten.`
              : "Alle Fälle, Begleitungen, Schulen, Kommunen und Verläufe werden entfernt. Die Einstellungen werden zurückgesetzt."}
          </p>
          <p>
            Vorher wird automatisch eine Sicherung im Datenordner erstellt.
            Vorhandene Sicherungen und exportierte Dateien bleiben erhalten.
          </p>
          <TextField
            autoFocus
            fullWidth
            label={`Zur Bestätigung ${destruction?.record?.id || "RESET"} eingeben`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDestruction(null)}>
            Abbrechen
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={
              busy || confirmation !== (destruction?.record?.id || "RESET")
            }
            onClick={destroy}
          >
            {destruction?.record ? "Endgültig löschen" : "Alles zurücksetzen"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!question} maxWidth="xs" fullWidth>
        <DialogTitle>{question?.title}</DialogTitle>
        <DialogContent>
          <p>{question?.message}</p>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              question.resolve(false);
              setQuestion(null);
            }}
          >
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              question.resolve(true);
              setQuestion(null);
            }}
          >
            {question?.confirm}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!importInfo}
        onClose={() => {
          setImportInfo(null);
          api("cancelImport");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import prüfen</DialogTitle>
        <DialogContent>
          {importInfo && (
            <>
              <p className="filename">{importInfo.name}</p>
              <div className="import-counts">
                <strong>{importInfo.cases.length} Fälle</strong>
                <strong>{importInfo.staff} Begleitungen</strong>
              </div>
              {importInfo.existing > 0 && (
                <Alert severity="warning">
                  Die vorhandenen {importInfo.existing} Fälle werden ersetzt.
                  Vorher erstellt SIO automatisch eine Sicherung.
                </Alert>
              )}
              <p>
                Rechnungsabstand: {importInfo.settings.invoiceInterval} Tage
              </p>
              {importInfo.notes.map((x) => (
                <p key={x} className="muted">
                  {x}
                </p>
              ))}
              <div className="import-list">
                {importInfo.cases.map((c) => (
                  <div key={c.id}>
                    <span>{c.id}</span>
                    <strong>{c.name}</strong>
                    <span>{c.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setImportInfo(null);
              api("cancelImport");
            }}
          >
            Abbrechen
          </Button>
          <Button
            disabled={busy}
            variant="contained"
            onClick={() =>
              run(async () => {
                const s = await api("applyImport");
                setState(s);
                setImportInfo(null);
                go("dashboard");
                notify("Daten übernommen");
              })
            }
          >
            {busy ? "Wird übernommen …" : "Daten übernehmen"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.severity === "error" ? 12000 : 3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast?.severity || "success"}
          onClose={() => setToast(null)}
          sx={{ maxWidth: 800, whiteSpace: "pre-line" }}
        >
          {toast?.text}
        </Alert>
      </Snackbar>
    </>
  );
}

function Editor({
  kind,
  record,
  state,
  onSave,
  onClose,
  ask,
  notify,
  addMaster,
  addStaff,
  anchor,
  nested = false,
}) {
  const [draft, setDraft] = useState({ ...record }),
    [tab, setTab] = useState(0),
    [errors, setErrors] = useState({}),
    [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(record);
  const cases = kind === "cases";
  useDirty(dirty);
  const set = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const close = async () => {
    if (
      !saving &&
      (!dirty ||
        (await ask(
          "Änderungen verwerfen?",
          "Deine Eingaben sind noch nicht gespeichert.",
          "Verwerfen",
        )))
    )
      onClose();
  };
  const save = async (e) => {
    e?.preventDefault();
    const err = validateRecord(kind, draft, state);
    setErrors(err);
    if (Object.keys(err).length) {
      const keys = Object.keys(err);
      setTab(
        cases
          ? keys.some((k) =>
              [
                "name",
                "schoolId",
                "municipalityId",
                "staffId",
                "status",
                "hours",
              ].includes(k),
            )
            ? 0
            : keys.some((k) =>
                  ["approvalDate", "planDate", "invoiceDate"].includes(k),
                )
              ? 1
              : keys.some((k) =>
                    [
                      "documents",
                      "documentsDate",
                      "report",
                      "reportDate",
                      "parentDate",
                    ].includes(k),
                  )
                ? 2
                : 3
          : 0,
      );
      notify("Bitte die markierten Eingaben prüfen.", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(kind, draft);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const field = (name, props = {}) => (
    <Field
      key={name}
      name={name}
      value={draft[name]}
      onChange={(v) => set(name, v)}
      errors={errors}
      {...props}
    />
  );
  const selectMaster = (key, options, title, onNew) => (
    <div className="select-plus">
      <Autocomplete
        value={options.find((o) => o.id === draft[key]) || null}
        options={selectable(options, record[key])}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, v) => {
          set(key, v?.id || "");
          if (key === "schoolId" && !draft.municipalityId && v)
            set("municipalityId", v.municipalityId);
        }}
        renderOption={(props, o) => (
          <li {...props} key={o.id}>
            <span>
              {o.name}
              {key === "schoolId" && (
                <small className="option-sub">
                  {resolve(state, "municipalityId", o.municipalityId)}
                </small>
              )}
            </span>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={title}
            error={!!errors[key]}
            helperText={errors[key]}
          />
        )}
        noOptionsText="Kein Eintrag gefunden"
      />
      <Tooltip title={`${title} anlegen`}>
        <IconButton className="icon-box" onClick={onNew}>
          <Plus size={19} />
        </IconButton>
      </Tooltip>
    </div>
  );
  const paperStyle = anchor
    ? {
        position: "fixed",
        top: Math.min(anchor.bottom + 10, 130),
        right: Math.max(20, window.innerWidth - anchor.right),
        margin: 0,
        maxHeight: "calc(100vh - 155px)",
        width: 780,
      }
    : {};
  return (
    <Dialog
      open
      onClose={close}
      onKeyDown={(event) => saveShortcut(event, save, { disabled: saving })}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: paperStyle },
        backdrop: anchor
          ? { sx: { backgroundColor: "transparent" } }
          : undefined,
      }}
    >
      <DialogTitle className="dialog-title">
        <span>
          {cases
            ? record.id
              ? "Fall bearbeiten"
              : "Fall anlegen"
            : record.id
              ? "Begleitung bearbeiten"
              : "Begleitung hinzufügen"}
        </span>
        <IconButton onClick={close} aria-label="Schließen">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      {cases && (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          className="form-tabs"
        >
          {["Stammdaten", "Fristen", "Dokumentation", "Kontakt & Notizen"].map(
            (t) => (
              <Tab label={t} key={t} />
            ),
          )}
        </Tabs>
      )}
      <DialogContent className="editor-content">
        {cases ? (
          <>
            {tab === 0 && (
              <div className="form-grid">
                {field("name", { required: true, autoFocus: true })}
                {field("status", { options: caseStatus })}
                {selectMaster("schoolId", state.schools, "Schule", () =>
                  addMaster("schools", (id) => set("schoolId", id)),
                )}
                {selectMaster(
                  "municipalityId",
                  state.municipalities,
                  "Zuständige Kommune",
                  () =>
                    addMaster("municipalities", (id) =>
                      set("municipalityId", id),
                    ),
                )}
                <div className="span2">
                  {field("diagnosis", { multiline: true, minRows: 2 })}
                </div>
                <div className="select-plus">
                  <Autocomplete
                    options={selectable(state.staff, record.staffId)}
                    value={
                      state.staff.find((s) => s.id === draft.staffId) || null
                    }
                    getOptionLabel={(s) => `${s.name} · ${s.type}`}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, v) => set("staffId", v?.id || "")}
                    noOptionsText="Keine Begleitung gefunden"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Begleitung"
                        error={!!errors.staffId}
                        helperText={errors.staffId}
                      />
                    )}
                    renderOption={(props, s) => (
                      <li {...props} key={s.id}>
                        <span>
                          {s.name}
                          <small className="option-sub">
                            {s.type} · {s.internal}
                            {s.provider ? " · " + s.provider : ""}
                          </small>
                        </span>
                      </li>
                    )}
                  />
                  <Tooltip title="Begleitung hinzufügen">
                    <IconButton
                      className="icon-box"
                      onClick={() => addStaff((id) => set("staffId", id))}
                    >
                      <Plus size={19} />
                    </IconButton>
                  </Tooltip>
                </div>
                {field("hours", { type: "number" })}
              </div>
            )}
            {tab === 1 && (
              <div className="form-grid">
                {field("approvalDate", { type: "date" })}
                {field("planDate", { type: "date" })}
                {field("invoiceDate", { type: "date" })}
                <div className="calculated">
                  <span>Nächste Rechnungsfrist</span>
                  <strong>
                    {formatDate(overview(draft, state.settings).invoiceDue)}
                  </strong>
                  <small>
                    {state.settings.invoiceInterval} Tage nach letzter Rechnung
                  </small>
                </div>
                <Alert severity="info" className="span2">
                  Fehlende Termine können später ergänzt werden. Sie bleiben im
                  Dashboard sichtbar.
                </Alert>
              </div>
            )}
            {tab === 2 && (
              <div className="form-grid">
                {field("documents", { options: docStatus })}
                {field("documentsDate", { type: "date" })}
                <div className="span2">
                  {field("missingDocuments", { multiline: true, minRows: 2 })}
                </div>
                {field("report", { options: reportStatus })}
                {field("reportDate", { type: "date" })}
                {field("parentDate", { type: "date" })}
                <div />
                <div className="span2">
                  {field("parentNotes", { multiline: true })}
                </div>
              </div>
            )}
            {tab === 3 && (
              <div className="form-grid">
                <div className="span2">
                  {field("parentContact", { multiline: true, minRows: 2 })}
                </div>
                {field("phone")}
                {field("email", { type: "email" })}
                <div className="span2">
                  {field("notes", { multiline: true, minRows: 4 })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="form-grid">
            {field("type", { options: ["Person", "Träger"] })}
            {field("internal", { options: ["Intern", "Extern"] })}
            <div className="span2">
              {field("name", {
                label: draft.type === "Träger" ? "Name des Trägers" : "Name",
                required: true,
                autoFocus: true,
              })}
            </div>
            {field("provider")}
            {field("contact")}
            {field("phone")}
            {field("email", { type: "email" })}
            <div className="span2">{field("address")}</div>
            {field("qualification")}
            {field("hours", {
              type: "number",
              label: "Verfügbare Std. / Woche",
            })}
            <div className="span2">
              {field("notes", { multiline: true, minRows: 2 })}
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions className="form-footer">
        <span className="muted">
          {record.id || "Neuer Eintrag"}
          {dirty ? " · Ungespeichert" : ""}
        </span>
        <Button disabled={saving} onClick={close}>
          Abbrechen
        </Button>
        <Button
          disabled={saving}
          onClick={save}
          variant="contained"
          startIcon={
            saving ? <CircularProgress size={16} /> : <Save size={16} />
          }
        >
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StaffPage({ state, edit, go, onArchive }) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState("Alle"),
    [archiveView, setArchiveView] = useState(false);
  const filtered = state.staff.filter(
    (s) =>
      !!s.archivedAt === archiveView &&
      (type === "Alle" || s.type === type) &&
      [s.name, s.provider, s.contact, s.id]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Begleitungen</h1>
          <span className="muted">
            {state.staff.length} Personen und Träger
          </span>
        </div>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={(e) => edit("staff", null, e)}
        >
          Begleitung hinzufügen
        </Button>
      </div>
      <Tabs
        value={archiveView ? 1 : 0}
        onChange={(_, v) => setArchiveView(v === 1)}
        className="detail-tabs"
      >
        <Tab
          label={`Aktiv (${state.staff.filter((s) => !s.archivedAt).length})`}
        />
        <Tab
          label={`Archiv (${state.staff.filter((s) => s.archivedAt).length})`}
        />
      </Tabs>
      <div className="staff-toolbar">
        <TextField
          placeholder="Person oder Träger suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Typ"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {["Alle", "Person", "Träger"].map((v) => (
            <MenuItem value={v} key={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <div className="staff-grid">
        {filtered.map((s) => {
          const cases = state.cases.filter(
            (c) =>
              c.staffId === s.id && c.status !== "Beendet" && !c.archivedAt,
          );
          const used = cases.reduce((sum, c) => sum + Number(c.hours || 0), 0);
          return (
            <section className="staff-card" key={s.id}>
              <div className="staff-card-top">
                <div
                  className={"avatar " + (s.type === "Träger" ? "teal" : "")}
                >
                  {s.type === "Träger" ? (
                    <Building2 size={24} />
                  ) : (
                    <UserRound size={24} />
                  )}
                </div>
                <Badge
                  value={s.internal}
                  kind={s.internal === "Extern" ? "teal" : "purple"}
                />
                <Tooltip title="Begleitung bearbeiten">
                  <IconButton onClick={(e) => edit("staff", s, e)}>
                    <Pencil size={17} />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    s.archivedAt
                      ? "Wieder aktivieren"
                      : "Begleitung archivieren"
                  }
                >
                  <IconButton
                    aria-label={
                      s.archivedAt
                        ? "Begleitung wieder aktivieren"
                        : "Begleitung archivieren"
                    }
                    onClick={() => onArchive("staff", s)}
                  >
                    {s.archivedAt ? (
                      <ArchiveRestore size={17} />
                    ) : (
                      <Archive size={17} />
                    )}
                  </IconButton>
                </Tooltip>
              </div>
              <h2>{s.name}</h2>
              {s.archivedAt && <Badge value="Archiviert" kind="neutral" />}
              <p className="muted">
                {s.type}
                {s.provider ? " · " + s.provider : ""}
              </p>
              <div className="contact-lines">
                <div>
                  <UserRound size={15} />
                  {s.contact || s.qualification || "–"}
                </div>
                <div>
                  <Phone size={15} />
                  {s.phone || "–"}
                </div>
                <div>
                  <Mail size={15} />
                  {s.email || "–"}
                </div>
              </div>
              <div className="capacity">
                <strong>{cases.length} aktive Fälle</strong>
                <span>
                  {used} / {s.hours || "–"} Std.
                </span>
              </div>
              {s.hours > 0 && used > s.hours && (
                <div className="capacity-warning">
                  {used - s.hours} Stunden über Kapazität
                </div>
              )}
              <div className="staff-cases">
                {cases.map((c) => (
                  <button key={c.id} onClick={() => go("cases/" + c.id)}>
                    {c.name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title={
            archiveView
              ? "Keine archivierten Begleitungen"
              : "Keine Begleitungen"
          }
          text={
            archiveView
              ? "Archivierte Personen und Träger erscheinen hier."
              : "Lege eine Person oder einen Träger an."
          }
        />
      )}
    </>
  );
}

function MasterPage({ state, addMaster, onArchive }) {
  const [archiveView, setArchiveView] = useState(false);
  const schools = state.schools.filter((s) => !!s.archivedAt === archiveView);
  return (
    <>
      <div className="page-heading">
        <h1>Stammdaten</h1>
      </div>
      <div className="detail-columns equal">
        <Section
          title="Schulen"
          action={
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => addMaster("schools")}
            >
              Schule anlegen
            </Button>
          }
        >
          <Tabs
            value={archiveView ? 1 : 0}
            onChange={(_, v) => setArchiveView(v === 1)}
          >
            <Tab
              label={`Aktiv (${state.schools.filter((s) => !s.archivedAt).length})`}
            />
            <Tab
              label={`Archiv (${state.schools.filter((s) => s.archivedAt).length})`}
            />
          </Tabs>
          {schools.map((s) => (
            <div className="master-row" key={s.id}>
              <School size={20} />
              <div>
                <strong>{s.name}</strong>
                <small>
                  {resolve(state, "municipalityId", s.municipalityId)}
                </small>
              </div>
              <Tooltip title="Schule bearbeiten">
                <IconButton onClick={() => addMaster("schools", null, s)}>
                  <Pencil size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={
                  s.archivedAt ? "Wieder aktivieren" : "Schule archivieren"
                }
              >
                <IconButton
                  aria-label={
                    s.archivedAt
                      ? "Schule wieder aktivieren"
                      : "Schule archivieren"
                  }
                  onClick={() => onArchive("schools", s)}
                >
                  {s.archivedAt ? (
                    <ArchiveRestore size={16} />
                  ) : (
                    <Archive size={16} />
                  )}
                </IconButton>
              </Tooltip>
            </div>
          ))}
          {!schools.length && (
            <Empty
              title={
                archiveView
                  ? "Keine archivierten Schulen"
                  : "Noch keine Schulen"
              }
            />
          )}
        </Section>
        <Section
          title="Kommunen"
          action={
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => addMaster("municipalities")}
            >
              Kommune anlegen
            </Button>
          }
        >
          {state.municipalities.map((s) => (
            <div className="master-row" key={s.id}>
              <Building2 size={20} />
              <div>
                <strong>{s.name}</strong>
                <small>
                  {state.cases.filter((c) => c.municipalityId === s.id).length}{" "}
                  Fälle
                </small>
              </div>
              <Tooltip title="Kommune bearbeiten">
                <IconButton
                  onClick={() => addMaster("municipalities", null, s)}
                >
                  <Pencil size={16} />
                </IconButton>
              </Tooltip>
            </div>
          ))}
          {!state.municipalities.length && (
            <Empty title="Noch keine Kommunen" />
          )}
        </Section>
      </div>
    </>
  );
}

function MasterEditor({
  kind,
  record,
  state,
  onSave,
  onClose,
  notify,
  ask,
  onCreateMunicipality,
}) {
  const [draft, setDraft] = useState(record),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false),
    [municipalityOpen, setMunicipalityOpen] = useState(false);
  const schools = kind === "schools";
  useDirty(JSON.stringify(draft) !== JSON.stringify(record));
  const similar = state[kind].filter(
    (x) =>
      x.id !== draft.id &&
      similarity(x.name, draft.name) >= 0.72 &&
      (!schools || x.municipalityId === draft.municipalityId),
  );
  const saveDisabled =
    busy ||
    !draft.name.trim() ||
    (schools && !draft.municipalityId) ||
    (similar.length > 0 && !ack) ||
    municipalityOpen;
  const save = async () => {
    if (saveDisabled) return;
    setBusy(true);
    try {
      await onSave(draft);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (
      JSON.stringify(record) === JSON.stringify(draft) ||
      (await ask(
        "Änderungen verwerfen?",
        "Die Stammdaten sind noch nicht gespeichert.",
        "Verwerfen",
      ))
    )
      onClose();
  };
  return (
    <>
      <Dialog
        open
        onClose={close}
        fullWidth
        maxWidth="sm"
        onKeyDown={(event) =>
          saveShortcut(event, save, {
            plainEnter: true,
            disabled: saveDisabled,
          })
        }
      >
        <DialogTitle>
          {schools ? "Schule" : "Kommune"}{" "}
          {record.id ? "bearbeiten" : "anlegen"}
        </DialogTitle>
        <DialogContent>
          <div className="form-grid one">
            <TextField
              label="Name"
              autoFocus
              required
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setAck(false);
              }}
            />
            {schools && (
              <div className="select-plus">
                <Autocomplete
                  options={state.municipalities}
                  noOptionsText="Keine Kommune gefunden"
                  value={
                    state.municipalities.find(
                      (m) => m.id === draft.municipalityId,
                    ) || null
                  }
                  getOptionLabel={(m) => m.name}
                  onChange={(_, v) => {
                    setDraft({ ...draft, municipalityId: v?.id || "" });
                    setAck(false);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} required label="Ort der Schule" />
                  )}
                />
                <Tooltip title="Kommune anlegen">
                  <IconButton
                    aria-label="Kommune anlegen"
                    className="icon-box"
                    onClick={() => setMunicipalityOpen(true)}
                  >
                    <Plus size={19} />
                  </IconButton>
                </Tooltip>
              </div>
            )}
            {similar.length > 0 && (
              <>
                <Alert severity="warning">
                  Ähnliche Einträge: {similar.map((x) => x.name).join(", ")}
                </Alert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                  }
                  label="Dies ist ein anderer Eintrag."
                />
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={close}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            disabled={saveDisabled}
            title="Speichern (Enter)"
            onClick={save}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
      {municipalityOpen && (
        <MasterEditor
          kind="municipalities"
          record={{ name: "" }}
          state={state}
          onSave={async (record) => {
            const id = await onCreateMunicipality(record);
            setDraft((d) => ({ ...d, municipalityId: id }));
            setAck(false);
            setMunicipalityOpen(false);
          }}
          onClose={() => setMunicipalityOpen(false)}
          ask={ask}
          notify={notify}
        />
      )}
    </>
  );
}

function SettingsPage({
  state,
  meta,
  setState,
  notify,
  ask,
  exportData,
  previewImport,
  backup,
  onReset,
  busy,
}) {
  const [draft, setDraft] = useState(state.settings),
    [errors, setErrors] = useState({}),
    [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings);
  useEffect(() => {
    setDraft(state.settings);
  }, [state.settings]);
  useDirty(dirty, true);
  const save = async () => {
    const e = validateSettings(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      setState(await api("settings", draft, state.revision));
      notify("Fristeinstellungen gespeichert");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <h1>Einstellungen</h1>
      </div>
      <div className="detail-columns equal">
        <Section title="Fristen">
          <div
            className="settings-fields"
            onKeyDown={(event) =>
              saveShortcut(event, save, { disabled: !dirty || saving })
            }
          >
            {Object.keys(state.settings).map((k) => (
              <TextField
                key={k}
                label={labels[k]}
                type="number"
                value={draft[k]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [k]: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                error={!!errors[k]}
                helperText={errors[k]}
                slotProps={{
                  htmlInput: {
                    min: k === "invoiceInterval" ? 1 : 0,
                    max: 3650,
                    step: 1,
                  },
                }}
              />
            ))}
            <p className="muted">
              Die nächste Rechnungsfrist ergibt sich aus dem letzten
              Rechnungsdatum plus Rechnungsabstand. Vorwarnungen gelten
              einschließlich des eingestellten Tages.
            </p>
            <Button
              variant="contained"
              startIcon={<Save size={16} />}
              disabled={!dirty || saving}
              onClick={save}
            >
              Einstellungen speichern
            </Button>
          </div>
        </Section>
        <div className="stack">
          <Section title="Daten zurücksetzen">
            <div className="settings-actions reset-actions">
              <p>
                Entfernt alle Daten und setzt die Einstellungen zurück. Vorher
                wird eine Sicherung erstellt.
              </p>
              <Button
                color="error"
                variant="outlined"
                disabled={busy || saving || dirty}
                onClick={onReset}
              >
                Alle Daten zurücksetzen
              </Button>
            </div>
          </Section>
          <Section title="Daten austauschen">
            <div className="settings-actions">
              <Button
                variant="outlined"
                startIcon={<Download size={17} />}
                onClick={exportData}
                disabled={busy}
              >
                Excel exportieren
              </Button>
              <p>
                Fallliste, Fälle, Begleitungen und Auswertung – mit Filtern,
                Formeln und Fristfarben.
              </p>
              <Button
                variant="outlined"
                startIcon={<Upload size={17} />}
                onClick={previewImport}
                disabled={busy}
              >
                Excel / Sicherung importieren
              </Button>
              <p>
                Vorschau vor der Übernahme. Ein Import ersetzt den aktuellen
                Datenbestand.
              </p>
              <Button
                variant="outlined"
                startIcon={<HardDrive size={17} />}
                onClick={backup}
                disabled={busy}
              >
                Vollständige Sicherung erstellen
              </Button>
              <p>
                Enthält auch den Änderungsverlauf. Automatische Sicherungen
                liegen im Datenordner.
              </p>
            </div>
          </Section>
          <Section title="Lokale Speicherung">
            <div className="storage-info">
              <ShieldCheck size={24} />
              <div>
                <strong>Auf diesem Computer</strong>
                <p>
                  Keine Cloud-Verbindung. Die Daten liegen im
                  Windows-Benutzerprofil. Datenbank und Exporte sind nicht
                  verschlüsselt.
                </p>
              </div>
            </div>
            <Button
              startIcon={<FolderOpen size={17} />}
              onClick={() =>
                api("openData").catch((e) => notify(e.message, "error"))
              }
            >
              Datenordner öffnen
            </Button>
            <small className="data-path">{meta.dataDir}</small>
            <small className="muted">SIO {meta.version}</small>
          </Section>
        </div>
      </div>
    </>
  );
}

if (document.getElementById("root"))
  createRoot(document.getElementById("root")).render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>,
  );
