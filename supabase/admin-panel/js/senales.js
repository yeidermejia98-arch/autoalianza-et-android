import { supabase, publicImageUrl, SIGNS_BUCKET } from "./supabaseClient.js";
import { escapeHtml, showToast, showError, openModal, closeModal } from "./ui.js";

let categories = [];
let signs = [];
let filterCategory = "";
let filterText = "";

export async function renderSenales(container) {
  container.innerHTML = `<p class="muted">Cargando señales…</p>`;
  await loadData();
  paint(container);
}

async function loadData() {
  const [{ data: cats, error: catErr }, { data: rows, error: sErr }] = await Promise.all([
    supabase.from("sign_categories").select("*").order("sort_order"),
    supabase.from("signs").select("*").order("sort_order"),
  ]);
  if (catErr) throw catErr;
  if (sErr) throw sErr;
  categories = cats || [];
  signs = rows || [];
}

function categoryInfo(key) {
  return categories.find((c) => c.key === key) || { label: key, accent_color: "#999" };
}

function paint(container) {
  const filtered = signs.filter((s) => {
    if (filterCategory && s.category !== filterCategory) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      if (!s.name.toLowerCase().includes(t) && !s.code.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Señales de tránsito</h2>
        <p class="muted">${signs.length} señales en total · ${categories.length} categorías</p>
      </div>
      <div class="section-actions">
        <button class="btn btn--primary" id="new-sign-btn">+ Nueva señal</button>
      </div>
    </div>

    <div class="toolbar">
      <select id="filter-category">
        <option value="">Todas las categorías</option>
        ${categories
          .map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label)}</option>`)
          .join("")}
      </select>
      <input type="search" id="filter-text" placeholder="Buscar por nombre o código…" />
    </div>

    <div class="sign-grid">
      ${filtered
        .map((s) => {
          const cat = categoryInfo(s.category);
          return `
        <div class="sign-card" data-code="${escapeHtml(s.code)}">
          <div class="sign-card__image" style="border-color:${cat.accent_color}">
            <img src="${publicImageUrl(s.image_path)}" alt="${escapeHtml(s.name)}"
                 onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'sign-card__placeholder',textContent:'Sin imagen'}))" />
          </div>
          <div class="sign-card__body">
            <span class="pill" style="background:${cat.accent_color}22;color:${cat.accent_color}">${escapeHtml(cat.short_label || cat.label)}</span>
            <strong class="mono">${escapeHtml(s.code)}</strong>
            <span class="truncate">${escapeHtml(s.name)}</span>
          </div>
          <div class="sign-card__actions">
            <button class="btn btn--sm edit-btn">Editar</button>
            <button class="btn btn--sm btn--danger delete-btn">Eliminar</button>
          </div>
        </div>`;
        })
        .join("") || `<p class="muted">No hay señales que coincidan.</p>`}
    </div>
  `;

  document.getElementById("filter-category").value = filterCategory;
  document.getElementById("filter-category").addEventListener("change", (e) => {
    filterCategory = e.target.value;
    paint(container);
  });
  document.getElementById("filter-text").value = filterText;
  document.getElementById("filter-text").addEventListener("input", (e) => {
    filterText = e.target.value;
    paint(container);
  });
  document.getElementById("new-sign-btn").addEventListener("click", () => openSignForm(container, null));

  container.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const code = e.target.closest(".sign-card").dataset.code;
      openSignForm(container, signs.find((s) => s.code === code));
    })
  );
  container.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const code = e.target.closest(".sign-card").dataset.code;
      if (!confirm(`¿Eliminar la señal ${code}? Esta acción no se puede deshacer.`)) return;
      const { error } = await supabase.from("signs").delete().eq("code", code);
      if (error) return showError(error, "No se pudo eliminar la señal.");
      showToast("Señal eliminada", "success");
      await loadData();
      paint(container);
    })
  );
}

function openSignForm(container, sign) {
  const isNew = !sign;
  const s = sign || {
    code: "",
    category: categories[0]?.key || "",
    name: "",
    meaning: "",
    image_path: "",
    sort_order: signs.length,
  };

  const body = openModal(
    isNew ? "Nueva señal" : `Editar señal ${escapeHtml(s.code)}`,
    `
    <form id="sign-form" class="form">
      <label>Código
        <input name="code" value="${escapeHtml(s.code)}" ${isNew ? "" : "readonly"} placeholder="ej. SR-47" required />
      </label>
      <label>Categoría
        <select name="category" required>
          ${categories
            .map(
              (c) =>
                `<option value="${escapeHtml(c.key)}" ${c.key === s.category ? "selected" : ""}>${escapeHtml(
                  c.label
                )}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>Nombre
        <input name="name" value="${escapeHtml(s.name)}" required />
      </label>
      <label>Significado (opcional)
        <textarea name="meaning" rows="3">${escapeHtml(s.meaning || "")}</textarea>
      </label>
      <label>Imagen
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" />
        ${
          s.image_path
            ? `<span class="muted small">Actual: ${escapeHtml(s.image_path)} (sube un archivo para reemplazarla)</span>`
            : `<span class="muted small">Sin imagen todavía.</span>`
        }
      </label>
      <label>Orden
        <input type="number" name="sort_order" value="${s.sort_order}" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );

  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#sign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    try {
      const fd = new FormData(e.target);
      const code = fd.get("code").trim();
      const category = fd.get("category");
      const file = fd.get("image");
      let imagePath = s.image_path || `${category}/${code}.png`;

      if (file && file.size > 0) {
        const ext = file.name.split(".").pop().toLowerCase();
        imagePath = `${category}/${code}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(SIGNS_BUCKET)
          .upload(imagePath, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
      }

      const payload = {
        code,
        category,
        name: fd.get("name").trim(),
        meaning: fd.get("meaning").trim() || null,
        image_path: imagePath,
        sort_order: parseInt(fd.get("sort_order"), 10) || 0,
      };
      const { error } = await supabase.from("signs").upsert(payload);
      if (error) throw error;

      showToast("Señal guardada", "success");
      closeModal();
      await loadData();
      paint(container);
    } catch (err) {
      showError(err, "No se pudo guardar la señal.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  });
}
