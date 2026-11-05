import { confirmAction } from "./confirmation";
type Translate = (key: string) => string;

const translate = (t: Translate, key: string, fallback: string) => {
  const value = t(key);
  return value && value !== key ? value : fallback;
};

export const confirmDelete = (t: Translate) => {
  return confirmAction({
    title: translate(t, "delete", "Delete"),
    message: translate(t, "confirmDelete", "Delete this item?"),
    confirmLabel: translate(t, "delete", "Delete"),
    cancelLabel: translate(t, "cancel", "Cancel"),
  });
};
