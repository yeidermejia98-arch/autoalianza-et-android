export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let toastTimer = null;
export function showToast(message, kind = "info") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `toast toast--${kind} toast--visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3500);
}

export function showError(err, fallback = "Ocurrió un error") {
  console.error(err);
  const message = err && err.message ? err.message : fallback;
  showToast(message, "error");
}

export function openModal(titleHtml, bodyHtml) {
  const overlay = document.getElementById("modal-overlay");
  document.getElementById("modal-title").innerHTML = titleHtml;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  overlay.classList.add("modal-overlay--visible");
  return document.getElementById("modal-body");
}

export function closeModal() {
  document.getElementById("modal-overlay").classList.remove("modal-overlay--visible");
  document.getElementById("modal-body").innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById("modal-close").addEventListener("click", closeModal);
});
