import { supabase } from "./supabaseClient.js";
import { escapeHtml, showToast, showError, openModal, closeModal } from "./ui.js";

let categories = [];
let questions = [];
let filterCategory = "";
let filterText = "";

export async function renderPreguntas(container) {
  container.innerHTML = `<p class="muted">Cargando preguntas…</p>`;
  await loadData();
  paint(container);
}

async function loadData() {
  const [{ data: cats, error: catErr }, { data: qs, error: qErr }] = await Promise.all([
    supabase.from("question_categories").select("*").order("sort_order"),
    supabase.from("questions").select("*").order("sort_order"),
  ]);
  if (catErr) throw catErr;
  if (qErr) throw qErr;
  categories = cats || [];
  questions = qs || [];
}

function categoryLabel(key) {
  const c = categories.find((c) => c.key === key);
  return c ? c.label : key;
}

function paint(container) {
  const filtered = questions.filter((q) => {
    if (filterCategory && q.category !== filterCategory) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      if (!q.question.toLowerCase().includes(t) && !q.id.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Preguntas</h2>
        <p class="muted">${questions.length} preguntas en total · ${categories.length} categorías</p>
      </div>
      <div class="section-actions">
        <button class="btn" id="manage-categories-btn">Gestionar categorías</button>
        <button class="btn btn--primary" id="new-question-btn">+ Nueva pregunta</button>
      </div>
    </div>

    <div class="toolbar">
      <select id="filter-category">
        <option value="">Todas las categorías</option>
        ${categories
          .map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label)}</option>`)
          .join("")}
      </select>
      <input type="search" id="filter-text" placeholder="Buscar por texto o ID…" />
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Categoría</th>
            <th>Dificultad</th>
            <th>Pregunta</th>
            <th>Gratis</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (q) => `
            <tr data-id="${escapeHtml(q.id)}">
              <td class="mono">${escapeHtml(q.id)}</td>
              <td>${escapeHtml(categoryLabel(q.category))}</td>
              <td><span class="pill pill--${q.difficulty}">${escapeHtml(q.difficulty)}</span></td>
              <td class="truncate" title="${escapeHtml(q.question)}">${escapeHtml(q.question)}</td>
              <td>${q.is_free ? "✅" : "—"}</td>
              <td class="row-actions">
                <button class="btn btn--sm edit-btn">Editar</button>
                <button class="btn btn--sm btn--danger delete-btn">Eliminar</button>
              </td>
            </tr>`
            )
            .join("") || `<tr><td colspan="6" class="muted">No hay preguntas que coincidan.</td></tr>`}
        </tbody>
      </table>
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
  document.getElementById("new-question-btn").addEventListener("click", () => openQuestionForm(container, null));
  document.getElementById("manage-categories-btn").addEventListener("click", () => openCategoriesModal(container));

  container.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      const q = questions.find((q) => q.id === id);
      openQuestionForm(container, q);
    })
  );
  container.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest("tr").dataset.id;
      if (!confirm(`¿Eliminar la pregunta ${id}? Esta acción no se puede deshacer.`)) return;
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) return showError(error, "No se pudo eliminar la pregunta.");
      showToast("Pregunta eliminada", "success");
      await loadData();
      paint(container);
    })
  );
}

function openQuestionForm(container, question) {
  const isNew = !question;
  const q = question || {
    id: "",
    category: categories[0]?.key || "",
    difficulty: "media",
    question: "",
    options: ["", "", "", ""],
    correct_index: 0,
    explanation: "",
    source: "",
    is_free: false,
    sort_order: questions.length,
  };

  const body = openModal(
    isNew ? "Nueva pregunta" : `Editar pregunta ${escapeHtml(q.id)}`,
    `
    <form id="question-form" class="form">
      <label>ID
        <input name="id" value="${escapeHtml(q.id)}" ${isNew ? "" : "readonly"} placeholder="ej. q137" required />
      </label>
      <label>Categoría
        <select name="category" required>
          ${categories
            .map(
              (c) =>
                `<option value="${escapeHtml(c.key)}" ${c.key === q.category ? "selected" : ""}>${escapeHtml(
                  c.label
                )}</option>`
            )
            .join("")}
        </select>
      </label>
      <label>Dificultad
        <select name="difficulty" required>
          ${["baja", "media", "alta"]
            .map((d) => `<option value="${d}" ${d === q.difficulty ? "selected" : ""}>${d}</option>`)
            .join("")}
        </select>
      </label>
      <label>Pregunta
        <textarea name="question" rows="3" required>${escapeHtml(q.question)}</textarea>
      </label>
      <fieldset class="options-fieldset">
        <legend>Opciones (marca la correcta)</legend>
        ${[0, 1, 2, 3]
          .map(
            (i) => `
          <div class="option-row">
            <input type="radio" name="correct_index" value="${i}" ${q.correct_index === i ? "checked" : ""} required />
            <input type="text" name="option_${i}" value="${escapeHtml(q.options[i] || "")}" placeholder="Opción ${i + 1}" required />
          </div>`
          )
          .join("")}
      </fieldset>
      <label>Explicación (opcional)
        <textarea name="explanation" rows="2">${escapeHtml(q.explanation || "")}</textarea>
      </label>
      <label>Fuente / cita (opcional)
        <input name="source" value="${escapeHtml(q.source || "")}" />
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="is_free" ${q.is_free ? "checked" : ""} />
        Pregunta gratuita (visible sin desbloquear el banco completo)
      </label>
      <label>Orden
        <input type="number" name="sort_order" value="${q.sort_order}" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );

  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#question-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      id: fd.get("id").trim(),
      category: fd.get("category"),
      difficulty: fd.get("difficulty"),
      question: fd.get("question").trim(),
      options: [0, 1, 2, 3].map((i) => fd.get(`option_${i}`).trim()),
      correct_index: parseInt(fd.get("correct_index"), 10),
      explanation: fd.get("explanation").trim() || null,
      source: fd.get("source").trim() || null,
      is_free: fd.get("is_free") === "on",
      sort_order: parseInt(fd.get("sort_order"), 10) || 0,
    };
    const { error } = await supabase.from("questions").upsert(payload);
    if (error) return showError(error, "No se pudo guardar la pregunta.");
    showToast("Pregunta guardada", "success");
    closeModal();
    await loadData();
    paint(container);
  });
}

function openCategoriesModal(container) {
  const body = openModal(
    "Categorías de preguntas",
    `
    <div class="cat-list">
      ${categories
        .map(
          (c) => `
        <div class="cat-row" data-key="${escapeHtml(c.key)}">
          <input class="cat-label-input" value="${escapeHtml(c.label)}" />
          <span class="mono muted">${escapeHtml(c.key)}</span>
          <button class="btn btn--sm cat-save-btn">Guardar</button>
        </div>`
        )
        .join("")}
    </div>
    <p class="muted small">Las categorías nuevas se agregan automáticamente si escribes una clave nueva al crear una pregunta con el mismo nombre; para renombrar las existentes, edítalas aquí.</p>
  `
  );
  body.querySelectorAll(".cat-row").forEach((row) => {
    row.querySelector(".cat-save-btn").addEventListener("click", async () => {
      const key = row.dataset.key;
      const label = row.querySelector(".cat-label-input").value.trim();
      if (!label) return;
      const { error } = await supabase.from("question_categories").update({ label }).eq("key", key);
      if (error) return showError(error, "No se pudo actualizar la categoría.");
      showToast("Categoría actualizada", "success");
      await loadData();
      paint(container);
      closeModal();
    });
  });
}
