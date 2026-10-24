// Enter in a short single-line form, Ctrl+Enter in multi-section forms.
// Autocomplete selection, IME composition and buttons keep their own behavior.
export function saveShortcut(
  event,
  save,
  { plainEnter = false, disabled = false } = {},
) {
  if (
    disabled ||
    !(
      event.key === "Enter" ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s")
    ) ||
    event.nativeEvent?.isComposing ||
    event.isComposing ||
    event.defaultPrevented
  )
    return;
  const nearest = event.target?.closest?.('[role="dialog"]');
  const owner =
    event.currentTarget.getAttribute?.("role") === "dialog"
      ? event.currentTarget
      : event.currentTarget.querySelector('[role="dialog"]');
  if (nearest && nearest !== owner) return;
  const target = event.target;
  const shortcut = event.ctrlKey || event.metaKey;
  if (
    !shortcut &&
    (!plainEnter ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "BUTTON" ||
      target?.getAttribute?.("role") === "combobox" ||
      target?.getAttribute?.("aria-expanded") === "true")
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  save();
}
