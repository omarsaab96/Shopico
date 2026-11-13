export type Lang = "en" | "ar";
export const LANGUAGE_STORAGE_KEY = "app-language";
const RELOAD_KEY = "app-language-direction-reload";

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};
type NativeDirection = {
  isRTL: boolean;
  allowRTL: (value: boolean) => void;
  forceRTL: (value: boolean) => void;
  swapLeftAndRightInRTL: (value: boolean) => void;
};

export async function restoreLanguage(storage: Storage, fallback: () => Lang): Promise<Lang> {
  const saved = await storage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === "ar" || saved === "en" ? saved : fallback();
}

export async function prepareLanguageDirection(
  lang: Lang, platform: string, storage: Storage, native: NativeDirection,
  reload: () => Promise<void>,
): Promise<void> {
  if (platform === "web") return;
  const rtl = lang === "ar";
  // Always write the intended flags, even if the current native snapshot matches.
  native.allowRTL(rtl);
  native.forceRTL(rtl);
  native.swapLeftAndRightInRTL(true);
  if (native.isRTL === rtl) {
    await storage.removeItem(RELOAD_KEY);
    return;
  }
  const attempt = `${lang}:${native.isRTL}`;
  if (await storage.getItem(RELOAD_KEY) !== attempt) {
    await storage.setItem(RELOAD_KEY, attempt);
    await reload();
  }
  // Do not render conflicting directions or enter an automatic reload loop.
  throw new Error("Close and reopen the app to finish applying the language.");
}
