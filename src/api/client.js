// src/api/client.js
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * MSAL user context (set from App.jsx after login)
 * We attach these to every API request so backend can write history attribution.
 */
let USER = { email: "", name: "", oid: "" };

export function setUserContext({ email = "", name = "", oid = "" } = {}) {
  USER = {
    email: (email || "").toLowerCase().trim(),
    name: (name || "").trim(),
    oid: (oid || "").trim(),
  };
}

async function parseMaybeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

function buildHeaders(hasBody) {
  const headers = {};

  if (hasBody) headers["Content-Type"] = "application/json";

  // attach Microsoft user info (for history attribution)
  if (USER.email) headers["X-User-Email"] = USER.email;
  if (USER.name) headers["X-User-Name"] = USER.name;
  if (USER.oid) headers["X-User-Oid"] = USER.oid;

  return Object.keys(headers).length ? headers : undefined;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: buildHeaders(false),
  });

  const body = await parseMaybeJson(res);
  if (!res.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
  return body;
}

export async function apiSend(path, method = "POST", payload) {
  const hasBody = payload !== undefined;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(hasBody),
    body: hasBody ? JSON.stringify(payload) : undefined,
  });

  const body = await parseMaybeJson(res);
  if (!res.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
  return body;
}

export async function apiUpload(path, formData) {
  // do NOT set Content-Type for FormData
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: buildHeaders(false),
    body: formData,
  });

  const body = await parseMaybeJson(res);
  if (!res.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
  return body;
}