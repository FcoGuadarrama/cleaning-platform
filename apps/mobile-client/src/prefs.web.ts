/** Device-local preferences; storage can be unavailable (private mode), so failures fall back to defaults. */
export const prefs = {
  async get(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(`pref.${key}`);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(`pref.${key}`, value);
    } catch {
      // Not persisted: the welcome screen shows again next visit, which is harmless.
    }
  },
};
