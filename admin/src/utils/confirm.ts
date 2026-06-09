type Translate = (key: string) => string;

const translate = (t: Translate, key: string, fallback: string) => {
  const value = t(key);
  return value && value !== key ? value : fallback;
};

export const confirmDelete = (t: Translate) => {
  return window.confirm(translate(t, "confirmDelete", "Delete this item?"));
};
