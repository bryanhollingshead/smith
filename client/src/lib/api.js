// Smith — API client
// Thin wrapper around fetch that injects the bearer token and rejects on
// non-2xx with the server's error message. Returns parsed JSON on success.

const TOKEN_KEY = 'smith.token';

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    // 401 means the token is bad — clear it so the next render shows sign-in.
    if (res.status === 401 && token) auth.clear();
    throw err;
  }
  return data;
}

// Multipart POST — used for file uploads. Key difference from `request`:
// we MUST NOT set Content-Type ourselves; the browser sets it (including the
// boundary string) when the body is a FormData. The auth header still
// gets attached.
async function uploadRequest(path, formData) {
  const headers = {};
  const token = auth.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    if (res.status === 401 && token) auth.clear();
    throw err;
  }
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
  upload: (path, fd)    => uploadRequest(path, fd),
};
