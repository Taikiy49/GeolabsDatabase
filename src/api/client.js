// src/api/client.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

async function parseMaybeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "GET" });
  const body = await parseMaybeJson(res);
  if (!res.ok) throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return body;
}

export async function apiSend(path, method = "POST", payload) {
  const hasBody = payload !== undefined;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(payload) : undefined,
  });

  const body = await parseMaybeJson(res);
  if (!res.ok) throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return body;
}

export async function apiUpload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  const body = await parseMaybeJson(res);
  if (!res.ok) throw new Error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return body;
}