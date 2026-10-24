import React, { useState, useEffect } from "react";
import {
  Button,
  IconButton,
  Tooltip,
  TextField,
  Autocomplete,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Save,
  X,
  Users,
  Building2,
  UserRound,
  History,
  ChevronDown,
} from "lucide-react";
import { api, useDirty, Badge, Empty, Field, Section } from "./ui.jsx";
import {
  labels,
  formatDate,
  resolve,
  tone,
  validateRecord,
  selectable,
  deadlineDistance,
  docStatus,
  reportStatus,
} from "../shared/model.mjs";
import { saveShortcut } from "./shortcuts.mjs";

export function CaseDetail({
  c,
  state,
  onBack,
  onEdit,
  onSave,
  notify,
  ask,
  now,
}) {
  const [tab, setTab] = useState(0),
    [history, setHistory] = useState([]),
    [editing, setEditing] = useState(null),
    [errors, setErrors] = useState({}),
    [saving, setSaving] = useState(false);
  const staff = state.staff.find((s) => s.id === c.staffId);
  const dirty =
    !!editing && JSON.stringify(editing.draft) !== JSON.stringify(editing.base);
  useDirty(dirty, true);
  useEffect(() => {
    api("history", c.id)
      .then(setHistory)
      .catch((e) => notify(e.message, "error"));
  }, [c.id, state.revision]);
  const abandon = async () => {
    if (saving) return false;
    if (
      dirty &&
      !(await ask(
        "Änderungen verwerfen?",
        "Die Änderungen in diesem Bereich sind noch nicht gespeichert.",
        "Verwerfen",
      ))
    )
      return false;
    setEditing(null);
    setErrors({});
    return true;
  };
  const start = async (key, kind = "cases") => {
    if (!(await abandon())) return;
    const record = kind === "staff" ? staff : c;
    setEditing({
      key,
      kind,
      draft: { ...record },
      base: { ...record },
      revision: state.revision,
    });
  };
  const set = (key, value) => {
    setEditing((e) => ({ ...e, draft: { ...e.draft, [key]: value } }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const save = async () => {
    if (!editing || saving) return;
    const error = validateRecord(editing.kind, editing.draft, state, now);
    setErrors(error);
    if (Object.keys(error).length) {
      notify("Bitte die markierten Eingaben prüfen.", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave(editing.kind, editing.draft, editing.revision);
      setEditing(null);
      setErrors({});
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const field = (key) => {
    const value = editing.draft[key];
    const collections = {
      schoolId: state.schools,
      municipalityId: state.municipalities,
      staffId: state.staff,
    };
    if (collections[key])
      return (
        <Autocomplete
          options={selectable(collections[key], editing.base[key])}
          value={collections[key].find((x) => x.id === value) || null}
          getOptionLabel={(x) => x.name + (x.archivedAt ? " (archiviert)" : "")}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="Kein aktiver Eintrag gefunden"
          onChange={(_, v) => {
            set(key, v?.id || "");
            if (key === "schoolId" && !editing.draft.municipalityId && v)
              set("municipalityId", v.municipalityId);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={labels[key]}
              error={!!errors[key]}
              helperText={errors[key]}
              size="small"
            />
          )}
        />
      );
    const options = {
      documents: docStatus,
      report: reportStatus,
      type: ["Person", "Träger"],
      internal: ["Intern", "Extern"],
    }[key];
    return (
      <Field
        name={key}
        label={
          editing.kind === "staff" && key === "name" ? "Name" : labels[key]
        }
        value={value}
        errors={errors}
        onChange={(v) => set(key, v)}
        type={
          key.endsWith("Date")
            ? "date"
            : key === "hours"
              ? "number"
              : key === "email"
                ? "email"
                : "text"
        }
        options={options}
        multiline={[
          "diagnosis",
          "notes",
          "missingDocuments",
          "parentNotes",
          "parentContact",
        ].includes(key)}
        minRows={2}
      />
    );
  };
  const actions = (key, kind = "cases") =>
    editing?.key === key ? (
      <div className="inline-actions">
        <Tooltip title="Abbrechen (Esc)">
          <IconButton
            aria-label={`${key} abbrechen`}
            disabled={saving}
            onClick={abandon}
          >
            <X size={17} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Speichern (Strg+Enter / Strg+S)">
          <IconButton
            color="primary"
            aria-label={`${key} speichern`}
            disabled={saving || !dirty}
            onClick={save}
          >
            <Save size={18} />
          </IconButton>
        </Tooltip>
      </div>
    ) : (
      <Tooltip title={`${key} bearbeiten`}>
        <IconButton
          aria-label={`${key} bearbeiten`}
          className="hover-edit"
          disabled={saving}
          onClick={() => start(key, kind)}
        >
          <Pencil size={16} />
        </IconButton>
      </Tooltip>
    );
  const data = (keys, record = c) => (
    <dl className="data-grid">
      {keys.map((key) => (
        <div key={key} className={editing ? "inline-field" : ""}>
          {editing ? (
            field(key)
          ) : (
            <>
              <dt>{labels[key]}</dt>
              <dd>
                {key.endsWith("Date")
                  ? formatDate(record[key])
                  : resolve(state, key, record[key]) || "–"}
                {["schoolId", "staffId"].includes(key) &&
                  { schoolId: state.schools, staffId: state.staff }[key].find(
                    (x) => x.id === record[key],
                  )?.archivedAt && <Badge value="Archiviert" kind="neutral" />}
              </dd>
            </>
          )}
        </div>
      ))}
    </dl>
  );
  const readData = (keys, record = c) => (
    <dl className="data-grid">
      {keys.map((key) => (
        <div key={key}>
          <dt>{labels[key]}</dt>
          <dd>
            {key.endsWith("Date")
              ? formatDate(record[key])
              : resolve(state, key, record[key]) || "–"}
            {key === "schoolId" &&
              state.schools.find((x) => x.id === record.schoolId)
                ?.archivedAt && <Badge value="Archiviert" kind="neutral" />}
          </dd>
        </div>
      ))}
    </dl>
  );
  const panel = (title, keys) => (
    <Section
      title={title}
      action={actions(title)}
      className={editing?.key === title ? "inline-editing" : ""}
    >
      {editing?.key === title ? data(keys) : readData(keys)}
    </Section>
  );
  const keyboard = (event) => {
    if (!editing || event.target.closest('[role="dialog"]')) return;
    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      event.target.getAttribute("aria-expanded") !== "true"
    ) {
      event.preventDefault();
      abandon();
      return;
    }
    saveShortcut(event, save, { disabled: saving || !dirty });
  };
  return (
    <div className="case-detail" onKeyDown={keyboard}>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={17} /> Zur Fallliste
      </button>
      <div className="page-heading detail-heading">
        <div>
          <span className="eyebrow">{c.id}</span>
          <h1>{c.name}</h1>
          <div className="detail-sub">
            <Badge
              value={c.status}
              kind={c.status === "Laufend" ? "purple" : "neutral"}
            />
            <span>
              {resolve(state, "schoolId", c.schoolId) || "Schule offen"}
            </span>
            <span>{resolve(state, "municipalityId", c.municipalityId)}</span>
          </div>
        </div>
        <Button
          variant="contained"
          startIcon={<Pencil size={16} />}
          onClick={async () => {
            if (await abandon()) onEdit();
          }}
        >
          Fall bearbeiten
        </Button>
      </div>
      <div className="deadline-cards">
        {c.ov.deadlines.map((d) => {
          const distance = deadlineDistance(d.date, d.status, now);
          const Icon = distance?.direction === "up" ? ArrowUp : ArrowDown;
          const dateKey = {
            approval: "approvalDate",
            plan: "planDate",
            invoice: "invoiceDate",
          }[d.key];
          const active = editing?.key === d.label;
          return (
            <div
              key={d.key}
              className={
                "deadline-card " +
                tone(d.status) +
                (active ? " inline-editing" : "")
              }
            >
              <div className="deadline-heading">
                <span>{d.label}</span>
                {actions(d.label)}
              </div>
              {active ? (
                <div className="deadline-input">
                  {field(dateKey)}
                  {d.key === "invoice" && (
                    <small>
                      Die Rechnungsfrist ergibt sich aus diesem Datum plus{" "}
                      {state.settings.invoiceInterval} Tagen.
                    </small>
                  )}
                </div>
              ) : (
                <>
                  <strong>{formatDate(d.date)}</strong>
                  <Badge value={d.status} />
                  {distance && (
                    <span className={"deadline-distance " + tone(d.status)}>
                      {distance.direction !== "today" && (
                        <Icon size={15} aria-hidden="true" />
                      )}
                      {distance.text}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <Tabs
        value={tab}
        onChange={async (_, v) => {
          if (v !== tab && (await abandon())) setTab(v);
        }}
        className="detail-tabs"
      >
        <Tab label="Überblick" />
        <Tab label="Dokumentation" />
        <Tab label="Kontakt" />
        <Tab label={`Verlauf (${history.length})`} />
      </Tabs>
      {tab === 0 && (
        <div className="detail-columns">
          {panel("Falldaten", [
            "schoolId",
            "municipalityId",
            "diagnosis",
            "hours",
            "approvalDate",
            "planDate",
            "invoiceDate",
            "notes",
          ])}
          <Section
            title="Begleitung"
            className={
              ["Begleitung", "Zuordnung"].includes(editing?.key)
                ? "inline-editing"
                : ""
            }
            action={
              <div className="inline-actions">
                {editing?.key === "Zuordnung"
                  ? actions("Zuordnung")
                  : editing?.key === "Begleitung"
                    ? actions("Begleitung", "staff")
                    : !staff
                      ? actions("Zuordnung")
                      : null}
              </div>
            }
          >
            {editing?.key === "Begleitung" ? (
              <>
                <p className="inline-note">
                  Änderungen an dieser Begleitung gelten für alle zugeordneten
                  Fälle.
                </p>
                {data(
                  [
                    "name",
                    "type",
                    "internal",
                    "provider",
                    "contact",
                    "phone",
                    "email",
                  ],
                  staff,
                )}
              </>
            ) : editing?.key === "Zuordnung" ? (
              data(["staffId"])
            ) : staff ? (
              <>
                <div className="person-heading edit-scope">
                  <div className="avatar">
                    {staff.type === "Träger" ? (
                      <Building2 size={24} />
                    ) : (
                      <UserRound size={24} />
                    )}
                  </div>
                  <div>
                    <h3>{staff.name}</h3>
                    <span className="muted">
                      {staff.type} · {staff.internal}
                    </span>
                    {staff.archivedAt && (
                      <Badge value="Archiviert" kind="neutral" />
                    )}
                  </div>
                  <div className="person-assignment-action">
                    {actions("Zuordnung")}
                  </div>
                </div>
                <div className="staff-content edit-scope">
                  <div className="staff-content-actions">
                    {actions("Begleitung", "staff")}
                  </div>
                  {readData(["provider", "contact", "phone", "email"], staff)}
                </div>
              </>
            ) : (
              <Empty
                title="Noch keine Begleitung"
                action={
                  <Button onClick={() => start("Zuordnung")}>
                    Begleitung zuordnen
                  </Button>
                }
              />
            )}
          </Section>
        </div>
      )}
      {tab === 1 && (
        <div className="detail-columns">
          {panel("Unterlagen & Schulbericht", [
            "documents",
            "documentsDate",
            "missingDocuments",
            "report",
            "reportDate",
          ])}
          {panel("Elterngespräch", ["parentDate", "parentNotes"])}
        </div>
      )}
      {tab === 2 &&
        panel("Elternkontakt", ["parentContact", "phone", "email", "notes"])}
      {tab === 3 && (
        <Section title="Änderungsverlauf">
          {history.length ? (
            history.map((h) => (
              <Accordion
                key={h.id}
                disableGutters
                elevation={0}
                className="audit-item"
              >
                <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                  <span className="audit-icon">
                    <History size={19} />
                  </span>
                  <div>
                    <strong>{h.action}</strong>
                    <small>
                      {new Date(h.at).toLocaleString("de-DE")} ·{" "}
                      {h.changes.length}{" "}
                      {h.changes.length === 1 ? "Feld" : "Felder"}
                    </small>
                  </div>
                </AccordionSummary>
                <AccordionDetails>
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Feld</th>
                        <th>Vorher</th>
                        <th>Nachher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.changes.map((x, i) => (
                        <tr key={i}>
                          <td>{x.field}</td>
                          <td>{String(x.before ?? "") || "–"}</td>
                          <td>{String(x.after ?? "") || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <Empty title="Noch keine Änderungen" />
          )}
        </Section>
      )}
    </div>
  );
}
