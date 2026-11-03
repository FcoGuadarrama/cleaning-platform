export async function getSessionToken(key: string): Promise<string | null> {
  return window.sessionStorage.getItem(key);
}

export async function setSessionToken(key: string, token: string): Promise<void> {
  window.sessionStorage.setItem(key, token);
}

export async function deleteSessionToken(key: string): Promise<void> {
  window.sessionStorage.removeItem(key);
}
