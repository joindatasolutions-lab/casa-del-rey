const STORAGE_KEY = "casa_del_rey_public_token";

export function getToken() {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(STORAGE_KEY, token);
  else sessionStorage.removeItem(STORAGE_KEY);
}
