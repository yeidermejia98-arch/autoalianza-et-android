import { initAuth, onAuthChange, getSession, signIn, signOut } from "./auth.js";
import { showError, showToast } from "./ui.js";
import { renderPreguntas } from "./preguntas.js";
import { renderSenales } from "./senales.js";
import { renderCodigo } from "./codigo.js";
import { renderHorarios } from "./horarios.js";

const TABS = {
  preguntas: renderPreguntas,
  senales: renderSenales,
  codigo: renderCodigo,
  horarios: renderHorarios,
};

let activeTab = "preguntas";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const nav = document.getElementById("app-nav");
const content = document.getElementById("content");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Ingresando…";
  try {
    const fd = new FormData(loginForm);
    await signIn(fd.get("email").trim(), fd.get("password"));
  } catch (err) {
    loginError.textContent = err.message || "No se pudo iniciar sesión.";
    loginError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Iniciar sesión";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut();
});

nav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-tab");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  paintNav();
  loadActiveTab();
});

function paintNav() {
  nav.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("nav-tab--active", btn.dataset.tab === activeTab);
  });
}

async function loadActiveTab() {
  try {
    await TABS[activeTab](content);
  } catch (err) {
    showError(err, "No se pudo cargar la sección.");
    content.innerHTML = `<p class="muted">Ocurrió un error al cargar esta sección. Intenta recargar la página.</p>`;
  }
}

onAuthChange((session) => {
  if (session) {
    loginScreen.hidden = true;
    appShell.hidden = false;
    userEmailEl.textContent = session.user?.email || "";
    paintNav();
    loadActiveTab();
  } else {
    appShell.hidden = true;
    loginScreen.hidden = false;
    loginForm.reset();
  }
});

initAuth();
