import { supabase } from "./supabaseClient.js";
import { escapeHtml, showToast, showError, openModal, closeModal } from "./ui.js";

let titulos = []; // each: { ...row, capitulos: [ { ...row, articulos: [...] } ] }
let selectedArticuloId = null;

export async function renderCodigo(container) {
  container.innerHTML = `<p class="muted">Cargando código de tránsito…</p>`;
  await loadData();
  paint(container);
}

async function loadData() {
  const [{ data: t, error: tErr }, { data: c, error: cErr }, { data: a, error: aErr }] = await Promise.all([
    supabase.from("codigo_titulos").select("*").order("sort_order"),
    supabase.from("codigo_capitulos").select("*").order("sort_order"),
    supabase.from("codigo_articulos").select("*").order("sort_order"),
  ]);
  if (tErr) throw tErr;
  if (cErr) throw cErr;
  if (aErr) throw aErr;

  titulos = (t || []).map((tit) => ({
    ...tit,
    capitulos: (c || [])
      .filter((cap) => cap.titulo_id === tit.id)
      .map((cap) => ({
        ...cap,
        articulos: (a || []).filter((art) => art.capitulo_id === cap.id),
      })),
  }));
}

function findArticulo(id) {
  for (const t of titulos) {
    for (const c of t.capitulos) {
      const art = c.articulos.find((a) => a.id === id);
      if (art) return { art, capitulo: c, titulo: t };
    }
  }
  return null;
}

function paint(container) {
  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2>Código de Tránsito</h2>
        <p class="muted">${titulos.length} títulos · ${titulos.reduce((n, t) => n + t.capitulos.length, 0)} capítulos ·
        ${titulos.reduce((n, t) => n + t.capitulos.reduce((m, c) => m + c.articulos.length, 0), 0)} artículos</p>
      </div>
      <div class="section-actions">
        <button class="btn btn--primary" id="new-titulo-btn">+ Nuevo título</button>
      </div>
    </div>

    <div class="codigo-tree">
      ${titulos
        .map(
          (t) => `
        <details class="tree-titulo" ${t.capitulos.some((c) => c.articulos.some((a) => a.id === selectedArticuloId)) ? "open" : ""}>
          <summary>
            <span><strong>Título ${escapeHtml(t.numero)}</strong> — ${escapeHtml(t.nombre)}</span>
            <span class="tree-actions">
              <button class="btn btn--xs" data-action="edit-titulo" data-id="${t.id}">Editar</button>
              <button class="btn btn--xs" data-action="new-capitulo" data-id="${t.id}">+ Capítulo</button>
              <button class="btn btn--xs btn--danger" data-action="delete-titulo" data-id="${t.id}">Eliminar</button>
            </span>
          </summary>
          <div class="tree-capitulos">
            ${t.capitulos
              .map(
                (c) => `
              <details class="tree-capitulo" ${c.articulos.some((a) => a.id === selectedArticuloId) ? "open" : ""}>
                <summary>
                  <span><strong>Capítulo ${escapeHtml(c.numero)}</strong> — ${escapeHtml(c.nombre)}</span>
                  <span class="tree-actions">
                    <button class="btn btn--xs" data-action="edit-capitulo" data-id="${c.id}">Editar</button>
                    <button class="btn btn--xs" data-action="new-articulo" data-id="${c.id}">+ Artículo</button>
                    <button class="btn btn--xs btn--danger" data-action="delete-capitulo" data-id="${c.id}">Eliminar</button>
                  </span>
                </summary>
                <ul class="tree-articulos">
                  ${c.articulos
                    .map(
                      (a) => `
                    <li class="${a.id === selectedArticuloId ? "tree-articulo--selected" : ""}" data-action="select-articulo" data-id="${a.id}">
                      <span class="mono">Art. ${escapeHtml(a.numero)}</span> — ${escapeHtml(a.encabezado)}
                    </li>`
                    )
                    .join("") || `<li class="muted">Sin artículos todavía.</li>`}
                </ul>
              </details>`
              )
              .join("") || `<p class="muted" style="padding-left:1rem">Sin capítulos todavía.</p>`}
          </div>
        </details>`
        )
        .join("") || `<p class="muted">Todavía no hay títulos. Crea el primero.</p>`}
    </div>

    <div id="articulo-detail" class="articulo-detail"></div>
  `;

  document.getElementById("new-titulo-btn").addEventListener("click", () => openTituloForm(container, null));

  container.querySelectorAll('[data-action="edit-titulo"]').forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const t = titulos.find((t) => t.id === btn.dataset.id);
      openTituloForm(container, t);
    })
  );
  container.querySelectorAll('[data-action="delete-titulo"]').forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const t = titulos.find((t) => t.id === btn.dataset.id);
      const nCap = t.capitulos.length;
      const nArt = t.capitulos.reduce((n, c) => n + c.articulos.length, 0);
      if (
        !confirm(
          `¿Eliminar el Título ${t.numero}? Esto también borrará sus ${nCap} capítulo(s) y ${nArt} artículo(s). Esta acción no se puede deshacer.`
        )
      )
        return;
      const { error } = await supabase.from("codigo_titulos").delete().eq("id", t.id);
      if (error) return showError(error, "No se pudo eliminar el título.");
      showToast("Título eliminado", "success");
      await loadData();
      paint(container);
    })
  );
  container.querySelectorAll('[data-action="new-capitulo"]').forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openCapituloForm(container, btn.dataset.id, null);
    })
  );
  container.querySelectorAll('[data-action="edit-capitulo"]').forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const info = capituloById(btn.dataset.id);
      openCapituloForm(container, info.titulo.id, info.capitulo);
    })
  );
  container.querySelectorAll('[data-action="delete-capitulo"]').forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const info = capituloById(btn.dataset.id);
      const nArt = info.capitulo.articulos.length;
      if (
        !confirm(
          `¿Eliminar el Capítulo ${info.capitulo.numero}? Esto también borrará sus ${nArt} artículo(s). Esta acción no se puede deshacer.`
        )
      )
        return;
      const { error } = await supabase.from("codigo_capitulos").delete().eq("id", info.capitulo.id);
      if (error) return showError(error, "No se pudo eliminar el capítulo.");
      showToast("Capítulo eliminado", "success");
      await loadData();
      paint(container);
    })
  );
  container.querySelectorAll('[data-action="new-articulo"]').forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openArticuloForm(container, btn.dataset.id, null);
    })
  );
  container.querySelectorAll('[data-action="select-articulo"]').forEach((li) =>
    li.addEventListener("click", () => {
      selectedArticuloId = li.dataset.id;
      paintArticuloDetail(container);
      container.querySelectorAll(".tree-articulo--selected").forEach((el) => el.classList.remove("tree-articulo--selected"));
      li.classList.add("tree-articulo--selected");
    })
  );

  paintArticuloDetail(container);
}

function capituloById(id) {
  for (const t of titulos) {
    const c = t.capitulos.find((c) => c.id === id);
    if (c) return { capitulo: c, titulo: t };
  }
  return null;
}

function paintArticuloDetail(container) {
  const detail = container.querySelector("#articulo-detail");
  if (!selectedArticuloId) {
    detail.innerHTML = `<p class="muted">Selecciona un artículo del árbol para verlo y editarlo aquí.</p>`;
    return;
  }
  const found = findArticulo(selectedArticuloId);
  if (!found) {
    detail.innerHTML = `<p class="muted">Selecciona un artículo del árbol para verlo y editarlo aquí.</p>`;
    return;
  }
  const { art, capitulo, titulo } = found;
  detail.innerHTML = `
    <div class="articulo-card">
      <p class="muted small">Título ${escapeHtml(titulo.numero)} › Capítulo ${escapeHtml(capitulo.numero)}</p>
      <form id="articulo-form" class="form">
        <label>Número
          <input name="numero" value="${escapeHtml(art.numero)}" required />
        </label>
        <label>Encabezado
          <input name="encabezado" value="${escapeHtml(art.encabezado)}" required />
        </label>
        <label>Texto
          <textarea name="texto" rows="10">${escapeHtml(art.texto)}</textarea>
        </label>
        <label>Notas (modificaciones legales — una por línea)
          <textarea name="notas" rows="3">${escapeHtml((art.notas || []).join("\n"))}</textarea>
        </label>
        <label>Orden
          <input type="number" name="sort_order" value="${art.sort_order}" />
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--danger" id="delete-articulo-btn">Eliminar artículo</button>
          <button type="submit" class="btn btn--primary">Guardar</button>
        </div>
      </form>
    </div>
  `;
  detail.querySelector("#articulo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      numero: fd.get("numero").trim(),
      encabezado: fd.get("encabezado").trim(),
      texto: fd.get("texto"),
      notas: fd
        .get("notas")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      sort_order: parseInt(fd.get("sort_order"), 10) || 0,
    };
    const { error } = await supabase.from("codigo_articulos").update(payload).eq("id", art.id);
    if (error) return showError(error, "No se pudo guardar el artículo.");
    showToast("Artículo guardado", "success");
    await loadData();
    paint(container);
  });
  detail.querySelector("#delete-articulo-btn").addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el Artículo ${art.numero}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("codigo_articulos").delete().eq("id", art.id);
    if (error) return showError(error, "No se pudo eliminar el artículo.");
    showToast("Artículo eliminado", "success");
    selectedArticuloId = null;
    await loadData();
    paint(container);
  });
}

function openTituloForm(container, titulo) {
  const isNew = !titulo;
  const t = titulo || { numero: "", nombre: "", sort_order: titulos.length };
  const body = openModal(
    isNew ? "Nuevo título" : `Editar título ${escapeHtml(t.numero)}`,
    `
    <form id="titulo-form" class="form">
      <label>Número (ej. "V", "VI")
        <input name="numero" value="${escapeHtml(t.numero)}" required />
      </label>
      <label>Nombre
        <input name="nombre" value="${escapeHtml(t.nombre)}" required />
      </label>
      <label>Orden
        <input type="number" name="sort_order" value="${t.sort_order}" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );
  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#titulo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      numero: fd.get("numero").trim(),
      nombre: fd.get("nombre").trim(),
      sort_order: parseInt(fd.get("sort_order"), 10) || 0,
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from("codigo_titulos").insert(payload));
    } else {
      ({ error } = await supabase.from("codigo_titulos").update(payload).eq("id", t.id));
    }
    if (error) return showError(error, "No se pudo guardar el título.");
    showToast("Título guardado", "success");
    closeModal();
    await loadData();
    paint(container);
  });
}

function openCapituloForm(container, tituloId, capitulo) {
  const isNew = !capitulo;
  const t = titulos.find((t) => t.id === tituloId);
  const c = capitulo || { numero: "", nombre: "", sort_order: t.capitulos.length };
  const body = openModal(
    isNew ? `Nuevo capítulo en Título ${escapeHtml(t.numero)}` : `Editar capítulo ${escapeHtml(c.numero)}`,
    `
    <form id="capitulo-form" class="form">
      <label>Número (ej. "I", "II")
        <input name="numero" value="${escapeHtml(c.numero)}" required />
      </label>
      <label>Nombre
        <input name="nombre" value="${escapeHtml(c.nombre)}" required />
      </label>
      <label>Orden
        <input type="number" name="sort_order" value="${c.sort_order}" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );
  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#capitulo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      titulo_id: tituloId,
      numero: fd.get("numero").trim(),
      nombre: fd.get("nombre").trim(),
      sort_order: parseInt(fd.get("sort_order"), 10) || 0,
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from("codigo_capitulos").insert(payload));
    } else {
      ({ error } = await supabase.from("codigo_capitulos").update(payload).eq("id", c.id));
    }
    if (error) return showError(error, "No se pudo guardar el capítulo.");
    showToast("Capítulo guardado", "success");
    closeModal();
    await loadData();
    paint(container);
  });
}

function openArticuloForm(container, capituloId, articulo) {
  // Only used for creating a brand-new artículo; editing happens inline in the detail panel.
  const info = capituloById(capituloId);
  const a = articulo || { numero: "", encabezado: "", texto: "", notas: [], sort_order: info.capitulo.articulos.length };
  const body = openModal(
    `Nuevo artículo en Capítulo ${escapeHtml(info.capitulo.numero)}`,
    `
    <form id="articulo-form" class="form">
      <label>Número
        <input name="numero" value="${escapeHtml(a.numero)}" required />
      </label>
      <label>Encabezado
        <input name="encabezado" value="${escapeHtml(a.encabezado)}" required />
      </label>
      <label>Texto
        <textarea name="texto" rows="8">${escapeHtml(a.texto)}</textarea>
      </label>
      <label>Notas (una por línea)
        <textarea name="notas" rows="2">${escapeHtml((a.notas || []).join("\n"))}</textarea>
      </label>
      <label>Orden
        <input type="number" name="sort_order" value="${a.sort_order}" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-btn">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar</button>
      </div>
    </form>
  `
  );
  body.querySelector("#cancel-btn").addEventListener("click", closeModal);
  body.querySelector("#articulo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      capitulo_id: capituloId,
      numero: fd.get("numero").trim(),
      encabezado: fd.get("encabezado").trim(),
      texto: fd.get("texto"),
      notas: fd
        .get("notas")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      sort_order: parseInt(fd.get("sort_order"), 10) || 0,
    };
    const { error } = await supabase.from("codigo_articulos").insert(payload);
    if (error) return showError(error, "No se pudo guardar el artículo.");
    showToast("Artículo guardado", "success");
    closeModal();
    await loadData();
    paint(container);
  });
}
