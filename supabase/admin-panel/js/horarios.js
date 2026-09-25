import { supabase } from "./supabaseClient.js";
import { escapeHtml, showToast, showError, openModal, closeModal } from "./ui.js";

let horarios = [];
let filterTipo = "";

const TIPO_LABEL = { teoria: "Teoría", taller: "Taller" };
const TIPO_PILL_CLASS = { teoria: "pill--baja", taller: "pill--media" };

export async function renderHorarios(container) {
  container.innerHTML = `<p class="muted">Cargando horarios…</p>`;
  await loadData();
  paint(container);
}

async function loadData() {
  const { data, error } = await supabase
    .from("horarios_clases")
    .select("*")
    .order("fecha")
    .order("hora_inicio");
  if (error) throw error;
  horarios = data || [];
}

function formatFecha(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  const raw = d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function paint(container) {
  const filtered = horarios.filter((h) => !filterTipo || h.tipo === filterTipo);
  const today = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Horarios de clases</h2>
        <p class="muted">${horarios.length} clases programadas · Teoría es abierta a todas las categorías</p>
      </div>
      <div class="section-actions">
        <button class="btn btn--primary" id="new-horario-btn">+ Nueva clase</button>
      </div>
    </div>

    <div class="toolbar">
      <select id="filter-tipo">
        <option value="">Todos los tipos</option>
        <option value="teoria">Teoría</option>
        <option value="taller">Taller</option>
      </select>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Instructor</th>
            <th>Lugar</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            filtered
              .map((h) => {
                const isPast = h.fecha < today;
                return `
            <tr data-id="${escapeHtml(h.id)}" style="${isPast ? "opacity:0.5" : ""}">
              <td>${escapeHtml(formatFecha(h.fecha))}</td>
              <td class="mono">${escapeHtml((h.hora_inicio || "").slice(0, 5))}–${escapeHtml(
                  (h.hora_fin || "").slice(0, 5)
                )}</td>
              <td><span class="pill ${TIPO_PILL_CLASS[h.tipo] || ""}">${escapeHtml(
                  TIPO_LABEL[h.tipo] || h.tipo
                )}</span></td>
              <td>${escapeHtml(h.instructor || "—")}</td>
              <td>${escapeHtml(h.lugar || "—")}</td>
              <td class="row-actions">
                <button class="btn btn--sm edit-btn">Editar</button>
                <button class="btn btn--sm btn--danger delete-btn">Eliminar</button>
              </td>
            </tr>`;
              })
              .join("") ||
            `<tr><td colspan="6" class="muted" style="text-align:center;padding:1.5rem;">No hay clases que coincidan.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("filter-tipo").value = filterTipo;
  document.getElementById("filter-tipo").addEventListener("change", (e) => {
    filterTipo = e.target.value;
    paint(container);
  });
  document.getElementById("new-horario-btn").addEventListener("click", () => openHorarioForm(container, null));

  container.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      openHorarioForm(container, horarios.find((h) => h.id === id));
    })
  );
  container.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest("tr").dataset.id;
      if (!confirm("¿Eliminar esta clase del horario? Esta acción no se puede deshacer.")) return;
      const { error } = await supabase.from("horarios_clases").delete().eq("id", id);
      if (error) return showError(error, "No se pudo eliminar la clase.");
      showToast("Clase eliminada", "success");
      await loadData();
      paint(container);
    })
  );
}

function openHorarioForm(container, horario) {
  const isNew = !horario;
  const h = horario || {
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: "07:00",
    hora_fin: "09:00",
    tipo: "teoria",
    instructor: "",
    lugar: "",
  };

  const body = openModal(
    isNew ? "Nueva clase" : "Editar clase",
    `
    <form id="horario-form" class="form">
      <label>Fecha
        <input type="date" name="fecha" value="${escapeHtml(h.fecha)}" required />
      </label>
      <label>Hora de inicio
        <input type="time" name="hora_inicio" value="${escapeHtml(h.hora_inicio)}" required />
      </label>
      <label>Hora de fin
        <input type="time" name="hora_fin" value="${escapeHtml(h.hora_fin)}" required />
      </label>
      <label>Tipo de clase
        <select name="tipo" required>
          <option value="teoria" ${h.tipo === "teoria" ? "selected" : ""}>Teoría</option>
          <option value="taller" ${h.tipo === "taller" ? "selected" : ""}>Taller</option>
        </select>
      </label>
      <label>Instructor (opcional)
        <input type="text" name="instructor" value="${escapeHtml(h.instructor || "")}" />
      </label>
      <label>Lugar (opcional)
        <input type="text" name="lugar" value="${escapeHtml(h.lugar || "")}" placeholder="ej. Aula 2, Taller mecánico" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );

  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#horario-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    try {
      const fd = new FormData(e.target);
      const horaInicio = fd.get("hora_inicio");
      const horaFin = fd.get("hora_fin");
      if (horaFin <= horaInicio) {
        throw new Error("La hora de fin debe ser posterior a la hora de inicio.");
      }
      const payload = {
        fecha: fd.get("fecha"),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        tipo: fd.get("tipo"),
        instructor: fd.get("instructor").trim() || null,
        lugar: fd.get("lugar").trim() || null,
      };
      if (!isNew) payload.id = h.id;
      const { error } = await supabase.from("horarios_clases").upsert(payload);
      if (error) throw error;

      showToast("Clase guardada", "success");
      closeModal();
      await loadData();
      paint(container);
    } catch (err) {
      showError(err, "No se pudo guardar la clase.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar";
    }
  });
}
