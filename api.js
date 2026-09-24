// ============================================================
//  API.JS — Camada de comunicação com o JSON Server
// ============================================================

const API_BASE = 'http://localhost:3000';


async function request(method, endpoint, body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);
  if (response.status === 204) return null;

  return response.json();
}

// ── RESERVAS ──────────────────────────────────────────────
async function apiGetReservas()          { return request('GET',    '/reservas'); }
async function apiPostReserva(dados)     { return request('POST',   '/reservas', dados); }
async function apiPutReserva(id, dados)  { return request('PUT',    `/reservas/${id}`, dados); }
async function apiDeleteReserva(id)      { return request('DELETE', `/reservas/${id}`); }

// ── USUÁRIOS ──────────────────────────────────────────────
async function apiGetUsuario(id)              { return request('GET',  `/usuarios/${id}`); }
async function apiGetUsuariosPorEmail(email)  { return request('GET',  `/usuarios?email=${encodeURIComponent(email)}`); }
async function apiPostUsuario(dados)          { return request('POST', '/usuarios', dados); }
async function apiPutUsuario(id, dados) {
  try {
    return await request('PUT', `/usuarios/${id}`, dados);
  } catch(e) {
    // fallback: tenta PATCH se PUT falhar
    return await request('PATCH', `/usuarios/${id}`, dados);
  }
}
