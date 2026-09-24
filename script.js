// ============================================================
//  SCRIPT.JS
// ============================================================

// Esconde a tela de login imediatamente se houver sessão salva
if (sessionStorage.getItem("sr_user")) {
  document.getElementById("page-landing").style.display = "none";
}

let currentUser = null;
let reservas = [];
let cancelTargetId = null;
let forgotUsuario = null;
let histFilter = "todos";
let reservasFilter = "todos";
let selectedSport = null;
let selectedTime = null;

const SPORTS_ICONS = { Futsal: "⚽", Vôlei: "🏐", Basquete: "🏀" };
const SPORTS_CLASS = { Futsal: "futsal", Vôlei: "volei", Basquete: "basquete" };
const TIMES = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function conflita(time, dur, lista, date) {
  // Bloqueia qualquer conflito na mesma data/horário independente do esporte
  // (quadra única — um esporte por vez)
  const novoInicio = toMin(time);
  const novoFim = novoInicio + parseInt(dur);
  return lista
    .filter((r) => r.date === date && r.status !== "cancelada")
    .some((r) => {
      const ei = toMin(r.time);
      const ef = ei + r.dur;
      return novoInicio < ef && novoFim > ei;
    });
}

// ============================================================
//  MODAIS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add("show");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

// ============================================================
//  AUTH
// ============================================================
function switchAuthTab(tab) {
  document
    .querySelectorAll(".auth-tab")
    .forEach((t, i) =>
      t.classList.toggle(
        "active",
        (tab === "login" && i === 0) || (tab === "register" && i === 1),
      ),
    );
  document.getElementById("form-login").style.display =
    tab === "login" ? "" : "none";
  document.getElementById("form-register").style.display =
    tab === "register" ? "" : "none";
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁️";
  }
}

async function doLogin() {
  clearErrors();
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  let valid = true;
  if (!email || !email.includes("@")) {
    showError("err-login-email");
    valid = false;
  }
  if (!pass || pass.length < 6) {
    showError("err-login-pass");
    valid = false;
  }
  if (!valid) return;

  showLoading();
  try {
    const lista = await apiGetUsuariosPorEmail(email);
    if (lista.length === 0) {
      hideLoading();
      document.getElementById("err-login-email").textContent =
        "E-mail não cadastrado";
      showError("err-login-email");
      return;
    }
    const usuario = lista[0];
    if (usuario.senha !== pass) {
      hideLoading();
      showError("err-login-pass");
      return;
    }
    currentUser = {
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      mat: usuario.mat || "",
      phone: usuario.phone || "",
      senha: usuario.senha,
      initials: usuario.name.substring(0, 2).toUpperCase(),
    };
  } catch (err) {
    hideLoading();
    toast(
      "Erro ao conectar com a API. Verifique se o JSON Server está rodando.",
      "error",
    );
    return;
  }
  // Lembrar de mim
  const lembrar = document.getElementById("remember-me");
  if (lembrar && lembrar.checked) {
    localStorage.setItem("sr_saved_email", currentUser.email);
    localStorage.setItem("sr_saved_senha", currentUser.senha);
  } else {
    localStorage.removeItem("sr_saved_email");
    localStorage.removeItem("sr_saved_senha");
  }

  await carregarReservas();
  enterApp();
  hideLoading();
}

async function doRegister() {
  clearErrors();
  const name = document.getElementById("reg-name").value.trim();
  const mat = document.getElementById("reg-mat").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  let valid = true;
  if (!name) {
    showError("err-reg-name");
    valid = false;
  }
  if (!mat || mat.length > 11 || !/^[0-9]+$/.test(mat)) {
    showError("err-reg-mat");
    valid = false;
  }
  if (!email || !email.includes("@")) {
    showError("err-reg-email");
    valid = false;
  }
  if (pass.length < 6) {
    showError("err-reg-pass");
    valid = false;
  }
  if (!valid) return;

  showLoading();
  try {
    const existente = await apiGetUsuariosPorEmail(email);
    if (existente.length > 0) {
      document.getElementById("err-reg-email").textContent =
        "E-mail já cadastrado";
      showError("err-reg-email");
      hideLoading();
      return;
    }
    const novoUsuario = await apiPostUsuario({
      name,
      email,
      mat,
      phone: "",
      senha: pass,
    });
    currentUser = {
      id: novoUsuario.id,
      name: novoUsuario.name,
      email: novoUsuario.email,
      mat: novoUsuario.mat || "",
      phone: "",
      senha: pass,
      initials: name.substring(0, 2).toUpperCase(),
    };
    toast("Conta criada com sucesso!", "success");
  } catch (err) {
    toast(
      "Erro ao criar conta. Verifique se o JSON Server está rodando.",
      "error",
    );
    hideLoading();
    return;
  }
  reservas = [];
  enterApp();
  hideLoading();
}

function doLogout() {
  sessionStorage.removeItem("sr_user");
  document.getElementById("app").classList.remove("active");
  document.getElementById("page-landing").style.display = "";
  currentUser = null;
  reservas = [];
}

function enterApp() {
  sessionStorage.setItem("sr_user", JSON.stringify(currentUser));
  document.getElementById("page-landing").style.display = "none";
  document.getElementById("app").classList.add("active");
  updateUserUI();
  navTo("reservas");
}

function updateUserUI() {
  document.getElementById("topbar-name").textContent = currentUser.name;
  document.getElementById("prof-name-display").textContent = currentUser.name;
  document.getElementById("prof-email-display").textContent = currentUser.email;
  document.getElementById("prof-name").value = currentUser.name;
  document.getElementById("prof-email").value = currentUser.email;
  document.getElementById("prof-mat").value = currentUser.mat || "";
  document.getElementById("prof-phone").value = currentUser.phone || "";

  // Carrega foto salva ou mostra iniciais
  const savedAvatar = localStorage.getItem("sr_avatar_" + currentUser.id);
  if (savedAvatar) {
    applyAvatar(savedAvatar);
  } else {
    document.getElementById("topbar-avatar").textContent = currentUser.initials;
    document.getElementById("prof-avatar").textContent = currentUser.initials;
  }
}

// ============================================================
//  ESQUECI SENHA
// ============================================================
function openForgotPassword() {
  forgotUsuario = null;
  const grp = document.getElementById("forgot-newpass-group");
  const btn = document.getElementById("btn-forgot-action");
  const inp = document.getElementById("forgot-email");
  if (grp) grp.style.display = "none";
  if (btn) btn.textContent = "Verificar e-mail";
  if (inp) {
    inp.value = "";
    inp.disabled = false;
  }
  openModal("modal-forgot");
}

async function doForgotPassword() {
  if (!forgotUsuario) {
    clearErrors();
    const email = document.getElementById("forgot-email").value.trim();
    if (!email || !email.includes("@")) {
      showError("err-forgot-email");
      return;
    }
    showLoading();
    try {
      const lista = await apiGetUsuariosPorEmail(email);
      if (lista.length === 0) {
        hideLoading();
        document.getElementById("err-forgot-email").textContent =
          "E-mail não cadastrado";
        showError("err-forgot-email");
        return;
      }
      forgotUsuario = lista[0];
      hideLoading();
      document.getElementById("forgot-newpass-group").style.display = "";
      document.getElementById("btn-forgot-action").textContent =
        "Salvar nova senha";
      document.getElementById("forgot-email").disabled = true;
      toast("E-mail encontrado! Digite sua nova senha.", "success");
    } catch (err) {
      hideLoading();
      toast("Erro ao conectar com a API.", "error");
    }
    return;
  }
  clearErrors();
  const novaSenha = document.getElementById("forgot-newpass").value;
  if (novaSenha.length < 6) {
    showError("err-forgot-newpass");
    return;
  }
  showLoading();
  try {
    await apiPutUsuario(forgotUsuario.id, {
      ...forgotUsuario,
      senha: novaSenha,
    });
    hideLoading();
    closeModal("modal-forgot");
    document.getElementById("forgot-email").disabled = false;
    forgotUsuario = null;
    toast("Senha alterada! Faça login.", "success");
  } catch (err) {
    hideLoading();
    toast("Erro ao salvar nova senha.", "error");
  }
}

// ============================================================
//  ALTERAR SENHA (perfil)
// ============================================================
async function doChangePassword() {
  clearErrors();
  const current = document.getElementById("cp-current").value;
  const novaSen = document.getElementById("cp-new").value;
  const confirm = document.getElementById("cp-confirm").value;
  let valid = true;
  if (current !== currentUser.senha) {
    showError("err-cp-current");
    valid = false;
  }
  if (novaSen.length < 6) {
    showError("err-cp-new");
    valid = false;
  }
  if (novaSen !== confirm) {
    showError("err-cp-confirm");
    valid = false;
  }
  if (!valid) return;

  showLoading();
  try {
    const payload = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      mat: currentUser.mat,
      phone: currentUser.phone,
      senha: novaSen,
    };
    await apiPutUsuario(currentUser.id, payload);
    currentUser.senha = novaSen;
    // Limpa os campos
    document.getElementById("cp-current").value = "";
    document.getElementById("cp-new").value = "";
    document.getElementById("cp-confirm").value = "";
    hideLoading();
    closeModal("modal-change-pass");
    toast("Senha alterada com sucesso!", "success");
  } catch (err) {
    hideLoading();
    toast("Erro ao alterar senha.", "error");
  }
}

// ============================================================
//  CARREGA RESERVAS
// ============================================================
async function carregarReservas() {
  try {
    const todas = await apiGetReservas();
    reservas = todas.filter((r) => String(r.userId) === String(currentUser.id));
  } catch (err) {
    toast("Não foi possível carregar as reservas.", "error");
    reservas = [];
  }
}

// ============================================================
//  NAVIGATION
// ============================================================
const PAGE_TITLES = {
  reservas: "Minhas Reservas",
  "nova-reserva": "Nova Reserva",
  historico: "Histórico",
  confirmacao: "Reserva Confirmada",
  perfil: "Meu Perfil",
  ajuda: "Ajuda",
};

function navTo(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".sidebar-item[data-page]")
    .forEach((i) => i.classList.remove("active"));
  const pageEl = document.getElementById("p-" + page);
  if (pageEl) pageEl.classList.add("active");
  const sideEl = document.querySelector(`.sidebar-item[data-page="${page}"]`);
  if (sideEl) sideEl.classList.add("active");
  document.getElementById("topbar-title").textContent = PAGE_TITLES[page] || "";
  if (page === "reservas") renderReservas();
  if (page === "historico") renderHistorico();
  if (page === "nova-reserva") resetNovaReserva();
}

// ============================================================
//  RESERVAS
// ============================================================
function renderReservas() {
  const list = document.getElementById("reservas-list");
  const filtered = reservas.filter(
    (r) => reservasFilter === "todos" || r.sport === reservasFilter,
  );
  const upcoming = filtered.filter((r) => r.status !== "cancelada");

  document.getElementById("stat-total").textContent = reservas.length;
  document.getElementById("stat-confirmed").textContent = reservas.filter(
    (r) => r.status === "confirmada",
  ).length;
  document.getElementById("stat-cancelled").textContent = reservas.filter(
    (r) => r.status === "cancelada",
  ).length;

  if (upcoming.length === 0) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-icon">🏟️</div>
      <div class="empty-title">Nenhuma reserva ativa</div>
      <div class="empty-sub">Clique em "+ Nova reserva" para agendar</div>
    </div>`;
    return;
  }

  list.innerHTML = upcoming
    .map(
      (r) => `
    <div class="reserve-card" id="card-${r.id}">
      <div class="reserve-sport-icon ${SPORTS_CLASS[r.sport]}">${SPORTS_ICONS[r.sport]}</div>
      <div class="reserve-info">
        <div class="reserve-sport">${r.sport}</div>
        <div class="reserve-detail">${formatDate(r.date)} · ${r.time} (${r.dur} min)</div>
        <div class="reserve-local">📍 ${r.local}</div>
        <div style="margin-top:0.5rem;">${badgeHtml(r.status)}</div>
        <div class="reserve-actions">
          <button class="btn-sm btn-danger" onclick="openCancelModal('${r.id}')">Cancelar</button>
          ${r.status === "confirmada" ? `<button class="btn-sm btn-success">✓ Confirmado</button>` : ""}
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function filterReservas(filter, el) {
  reservasFilter = filter;
  document
    .querySelectorAll("#p-reservas .filter-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderReservas();
}

// ============================================================
//  CANCELAR
// ============================================================
function openCancelModal(id) {
  cancelTargetId = id;
  openModal("modal-cancel");
}

async function confirmCancel() {
  const id = cancelTargetId;
  closeModal("modal-cancel");
  if (id === null || id === undefined) return;
  showLoading();
  try {
    // Atualiza status para cancelada (não deleta — mantém no histórico)
    const r = reservas.find((x) => String(x.id) === String(id));
    if (!r) throw new Error("Reserva não encontrada");
    const payload = { ...r, status: "cancelada" };
    await fetch(`http://localhost:3000/reservas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    r.status = "cancelada";
    cancelTargetId = null;
    toast("Reserva cancelada.", "info");
    renderReservas();
  } catch (err) {
    toast("Erro ao cancelar. Verifique o JSON Server.", "error");
  } finally {
    hideLoading();
  }
}

// ============================================================
//  NOVA RESERVA
// ============================================================
function resetNovaReserva() {
  selectedSport = null;
  selectedTime = null;
  document
    .querySelectorAll(".sport-select-card")
    .forEach((c) => c.classList.remove("selected"));
  document.getElementById("form-reserva").style.display = "none";
  document.getElementById("res-date").value = "";
  document.getElementById("res-players").value = "";
  document.getElementById("time-slots-container").innerHTML = "";
  clearErrors();
}

function selectSport(sport, el) {
  selectedSport = sport;
  selectedTime = null;
  document
    .querySelectorAll(".sport-select-card")
    .forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("form-reserva").style.display = "block";
  document.getElementById("form-reserva-title").textContent =
    `Agendar — ${sport}`;
  document.getElementById("time-slots-container").innerHTML = "";
  const date = document.getElementById("res-date").value;
  if (date) loadSlots();
}

function cancelForm() {
  resetNovaReserva();
}

function loadSlots() {
  const date = document.getElementById("res-date").value;
  const dur = parseInt(document.getElementById("res-dur").value) || 60;
  if (!date || !selectedSport) return;
  selectedTime = null;

  // Busca TODAS as reservas do sistema para bloquear conflitos entre contas
  apiGetReservas()
    .then((todas) => {
      const ativas = todas.filter(
        (r) => r.date === date && r.status !== "cancelada",
      );
      document.getElementById("time-slots-container").innerHTML = TIMES.map(
        (t) => {
          const bloqueado = conflita(t, 60, ativas, date);
          const invalido = !bloqueado && conflita(t, dur, ativas, date);
          const cls = bloqueado || invalido ? " occupied" : "";
          const title = bloqueado
            ? "Horário ocupado"
            : invalido
              ? "Conflito com reserva existente"
              : "";
          return `<div class="time-slot${cls}" title="${title}"
        onclick="${bloqueado || invalido ? "" : `selectTime('${t}', this)`}">${t}</div>`;
        },
      ).join("");
    })
    .catch(() => {
      document.getElementById("time-slots-container").innerHTML = TIMES.map(
        (t) =>
          `<div class="time-slot" onclick="selectTime('${t}', this)">${t}</div>`,
      ).join("");
    });
}

function selectTime(time, el) {
  selectedTime = time;
  document
    .querySelectorAll(".time-slot")
    .forEach((t) => t.classList.remove("selected"));
  el.classList.add("selected");
}

async function submitReserva() {
  clearErrors();
  const date = document.getElementById("res-date").value;
  const dur = document.getElementById("res-dur").value;
  const players = document.getElementById("res-players").value;
  let valid = true;
  if (!date) {
    showError("err-res-date");
    valid = false;
  }
  if (!selectedTime) {
    showError("err-res-time");
    valid = false;
  }
  if (!valid) return;

  showLoading();
  try {
    // Verificação final de conflito antes de salvar
    const todas = await apiGetReservas();
    const todasAtivas = todas.filter((r) => r.status !== "cancelada");
    if (conflita(selectedTime, dur, todasAtivas, date)) {
      hideLoading();
      toast(
        "Este horário foi reservado por outro usuário. Escolha outro.",
        "error",
      );
      loadSlots();
      return;
    }

    const nova = {
      userId: currentUser.id,
      sport: selectedSport,
      date,
      time: selectedTime,
      dur: parseInt(dur),
      local: "Quadra poliesportiva UNEX",
      status: "confirmada",
      players,
    };

    const salva = await apiPostReserva(nova);
    reservas.unshift(salva);

    document.getElementById("confirm-details").innerHTML = `
      <div class="confirm-row"><span class="confirm-row-label">Esporte</span><span class="confirm-row-value">${SPORTS_ICONS[salva.sport]} ${salva.sport}</span></div>
      <div class="confirm-row"><span class="confirm-row-label">Data</span><span class="confirm-row-value">${formatDate(salva.date)}</span></div>
      <div class="confirm-row"><span class="confirm-row-label">Horário</span><span class="confirm-row-value">${salva.time} (${salva.dur} min)</span></div>
      <div class="confirm-row"><span class="confirm-row-label">Local</span><span class="confirm-row-value">${salva.local}</span></div>
      <div class="confirm-row"><span class="confirm-row-label">Status</span><span class="confirm-row-value">${badgeHtml("confirmada")}</span></div>
    `;
    navTo("confirmacao");
    toast("Reserva confirmada com sucesso!", "success");
  } catch (err) {
    toast("Erro ao criar reserva. Verifique o JSON Server.", "error");
  } finally {
    hideLoading();
  }
}

// ============================================================
//  HISTORICO
// ============================================================
function filterHist(filter, el) {
  histFilter = filter;
  document
    .querySelectorAll("#p-historico .filter-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderHistorico();
}

function renderHistorico() {
  const search = (
    document.getElementById("hist-search").value || ""
  ).toLowerCase();
  const items = reservas.filter((r) => {
    // "cancelada" filtra por status, os demais filtram por esporte
    const matchSport =
      histFilter === "todos"
        ? true
        : histFilter === "cancelada"
          ? r.status === "cancelada"
          : r.sport === histFilter;
    const matchSearch =
      !search ||
      r.sport.toLowerCase().includes(search) ||
      r.date.includes(search) ||
      r.time.includes(search);
    return matchSport && matchSearch;
  });
  const tbody = document.getElementById("hist-tbody");
  const empty = document.getElementById("hist-empty");
  if (items.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = items
    .map(
      (r) => `
    <tr>
      <td><span style="font-size:1.1rem;">${SPORTS_ICONS[r.sport]}</span> ${r.sport}</td>
      <td>${formatDate(r.date)}</td>
      <td>${r.time} · ${r.dur} min</td>
      <td style="color:var(--text2);">${r.local}</td>
      <td>${badgeHtml(r.status)}</td>
    </tr>
  `,
    )
    .join("");
}

// ============================================================
//  PERFIL
// ============================================================
async function saveProfile(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const name = document.getElementById("prof-name").value.trim();
  const email = document.getElementById("prof-email").value.trim();
  const phone = document.getElementById("prof-phone").value.trim();
  const mat = document.getElementById("prof-mat").value.trim();

  if (!name || !email) {
    toast("Preencha nome e e-mail.", "error");
    return false;
  }

  showLoading();

  // Atualiza local imediatamente — sem depender da API para não causar logout
  currentUser.name = name;
  currentUser.email = email;
  currentUser.phone = phone;
  currentUser.mat = mat;
  currentUser.initials = name.substring(0, 2).toUpperCase();
  sessionStorage.setItem("sr_user", JSON.stringify(currentUser));
  updateUserUI();

  // Tenta salvar na API em background — se falhar, não afeta nada
  try {
    const payload = {
      id: currentUser.id,
      name,
      email,
      mat,
      phone,
      senha: currentUser.senha,
    };
    const resp = await fetch(
      `http://localhost:3000/usuarios/${currentUser.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!resp.ok) {
      // Tenta PATCH se PUT falhar
      await fetch(`http://localhost:3000/usuarios/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mat, phone }),
      });
    }
  } catch (err) {
    // Falha silenciosa — dados já foram atualizados localmente
    console.warn("Aviso: não foi possível sincronizar com a API:", err.message);
  }

  hideLoading();
  toast("Perfil atualizado com sucesso!", "success");
  return false;
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    // Salva no localStorage vinculado ao usuário
    localStorage.setItem("sr_avatar_" + currentUser.id, src);
    applyAvatar(src);
  };
  reader.readAsDataURL(file);
}

function applyAvatar(src) {
  if (!src) return;
  document.getElementById("prof-avatar").innerHTML =
    `<img src="${src}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  document.getElementById("topbar-avatar").innerHTML =
    `<img src="${src}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
}

// ============================================================
//  AJUDA
// ============================================================
function toggleHelp(item) {
  item.classList.toggle("open");
}

// ============================================================
//  UTILITIES
// ============================================================
function badgeHtml(status) {
  const map = {
    confirmada: `<span class="badge badge-confirmed">✓ Confirmada</span>`,
    pendente: `<span class="badge badge-pending">⏳ Pendente</span>`,
    cancelada: `<span class="badge badge-cancelled">✕ Cancelada</span>`,
  };
  return map[status] || "";
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const date = new Date(str + "T12:00:00");
  return `${days[date.getDay()]}, ${d}/${m}/${y}`;
}

function showLoading() {
  document.getElementById("loading").classList.add("show");
}
function hideLoading() {
  document.getElementById("loading").classList.remove("show");
}

function showError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

function clearErrors() {
  document.querySelectorAll(".form-error").forEach((e) => {
    e.classList.remove("show");
    if (e.id === "err-login-email") e.textContent = "E-mail inválido";
    if (e.id === "err-reg-email") e.textContent = "E-mail inválido";
    if (e.id === "err-forgot-email") e.textContent = "E-mail não cadastrado";
  });
}

function toast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  t.innerHTML = `<span>${icons[type] || ""}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(30px)";
    t.style.transition = "0.3s";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

document.getElementById("res-dur").addEventListener("change", () => {
  const date = document.getElementById("res-date").value;
  if (date && selectedSport) loadSlots();
});

document.getElementById("res-date").min = new Date()
  .toISOString()
  .split("T")[0];

// Restaura sessão se a página recarregar (ex: Live Server recarregando ao salvar db.json)
(async function restoreSession() {
  const saved = sessionStorage.getItem("sr_user");
  document.documentElement.style.visibility = ""; // sempre mostra
  if (!saved) return;
  try {
    currentUser = JSON.parse(saved);
    await carregarReservas();
    enterApp();
  } catch (e) {
    sessionStorage.removeItem("sr_user");
  }
})();

// Lembrar de mim — preenche campos e faz login automático se houver dados salvos
(async function autoLogin() {
  const email = localStorage.getItem("sr_saved_email");
  const senha = localStorage.getItem("sr_saved_senha");
  if (!email || !senha) return;

  // Preenche os campos
  const emailEl = document.getElementById("login-email");
  const passEl = document.getElementById("login-pass");
  const lembrar = document.getElementById("remember-me");
  if (emailEl) emailEl.value = email;
  if (passEl) passEl.value = senha;
  if (lembrar) lembrar.checked = true;

  // Tenta login automático
  try {
    const lista = await apiGetUsuariosPorEmail(email);
    if (lista.length === 0) {
      localStorage.removeItem("sr_saved_email");
      localStorage.removeItem("sr_saved_senha");
      return;
    }
    const usuario = lista[0];
    if (usuario.senha !== senha) {
      localStorage.removeItem("sr_saved_email");
      localStorage.removeItem("sr_saved_senha");
      return;
    }
    currentUser = {
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      mat: usuario.mat || "",
      phone: usuario.phone || "",
      senha: usuario.senha,
      initials: usuario.name.substring(0, 2).toUpperCase(),
    };
    await carregarReservas();
    enterApp();
  } catch (e) {
    // API offline — não faz nada, usuário loga manualmente
  }
})();
