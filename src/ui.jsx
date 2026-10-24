import React, { useId, useEffect } from "react";
import { TextField, MenuItem } from "@mui/material";
import { FolderOpen } from "lucide-react";
import { labels, tone } from "../shared/model.mjs";
export const api = async (name, ...args) => {
  if (!window.sco) throw Error("Bitte SIO über die Desktop-App starten.");
  const r = await window.sco[name](...args);
  if (!r.ok) throw Error(r.error);
  return r.value;
};
export const dirtySources = new Map();
export function useDirty(dirty, blockNavigation = false) {
  const id = useId();
  useEffect(() => {
    dirtySources.set(id, { dirty, blockNavigation });
    api("dirty", id, dirty);
    window.dispatchEvent(new Event("sco-dirty"));
    return () => {
      dirtySources.delete(id);
      api("dirty", id, false);
      window.dispatchEvent(new Event("sco-dirty"));
    };
  }, [dirty, blockNavigation, id]);
}
export function Badge({ value, kind }) {
  return <span className={"badge " + (kind || tone(value))}>{value}</span>;
}
export function Empty({ title = "Keine Einträge", text, action }) {
  return (
    <div className="empty">
      <FolderOpen size={34} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
export function Field({
  name,
  value,
  onChange,
  errors = {},
  options,
  type = "text",
  multiline = false,
  ...props
}) {
  return (
    <TextField
      label={labels[name] || name}
      value={value ?? ""}
      onChange={(e) =>
        onChange(type === "number" ? e.target.value : e.target.value)
      }
      error={!!errors[name]}
      helperText={errors[name]}
      select={!!options}
      type={type}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      slotProps={
        type === "date"
          ? { inputLabel: { shrink: true } }
          : type === "number"
            ? { htmlInput: { min: 0, max: 168, step: 0.5 } }
            : undefined
      }
      {...props}
    >
      {options?.map((v) => (
        <MenuItem key={v} value={v}>
          {v}
        </MenuItem>
      ))}
    </TextField>
  );
}
export function Section({ title, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
