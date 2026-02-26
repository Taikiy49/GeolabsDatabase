// src/auth/token.js
const KEY = "pnp_id_token";

export function setAccessToken(idToken) {
  if (!idToken) return;
  localStorage.setItem(KEY, idToken);
}

export function getAccessToken() {
  return localStorage.getItem(KEY) || "";
}

export function clearAccessToken() {
  localStorage.removeItem(KEY);
}