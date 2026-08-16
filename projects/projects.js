// ============================================
// OFFICE CA SYS projects editor — edits ONLY the projects portion of
// the shared "quados-draft" in localStorage. Lives in /projects, so
// all site paths are ../
//
// Same editing model as /admin:
//   field handlers STAGE into Proj.data (no save)
//   structural buttons RE-RENDER the form (no save)
//   "apply changes" COMMITS: saves the draft + refreshes the preview
//
// Data model additions over the old admin projects tab:
//   slug     — url-safe identifier, auto-filled from title, editable
//   images[] — replaces the single image; legacy `image` is kept
//              synced to images[0] on save for existing renderers
//   fields{} — values for custom fields defined in the schema
//   schema   — draft.projectSchema, exported as projects.schema.json
// ============================================
const DRAFT_KEY = "quados-draft";   // shared with /admin — one draft, two editors
const ROOT = "..";
const $ = (s) => document.querySelector(s);

const FIELD_TYPES = ["text", "textarea", "list"];

// tiny DOM helper (same as admin.js)
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k in n && k !== "list") n[k] = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}
const row = (...kids) => el("div", { class: "a-row" }, ...kids);
const field = (label, control) => el("label", { class: "a-field" }, el("span", {}, label), control);

const slugify = (s) => (s || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const imgSrc = (s) => !s ? "" : /^(https?:|data:|blob:)/.test(s) ? s : `${ROOT}/${s}`;

const Proj = {
  data: null,     // the whole shared draft {site, layouts, pages, projects, projectSchema}
  schema: null,   // alias of data.projectSchema

  async init() {
    const fetchJSON = (f, fallback) =>
      fetch(`${ROOT}/content/${f}.json`).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch content/${f}.json`);
        return r.json();
      }).catch((e) => {
        if (fallback !== undefined) return fallback;
        throw e;
      });

    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      this.data = JSON.parse(draft);
      if (!this.data.projects) this.data.projects = await fetchJSON("projects", []);
    } else {
      // seed the full draft so /admin and the preview iframe share it
      const [site, layouts, pages, projects] = await Promise.all(
        ["site", "layouts", "pages", "projects"].map((f) => fetchJSON(f))
      );
      this.data = { site, layouts, pages, projects };
    }

    // schema: draft copy wins; else the committed file; else empty
    this.schema = this.data.projectSchema ?? await fetchJSON("projects.schema", []);
    this.data.projectSchema = this.schema;

    this.migrate();
    this.save();

    $("#apply").addEventListener("click", () => this.applyAll());
    $("#export").addEventListener("click", () => this.export());
    $("#discard").addEventListener("click", () => {
      if (confirm("Discard draft and reload the committed json?")) {
        localStorage.removeItem(DRAFT_KEY);
        location.reload();
      }
    });

    this.render();
  },

  // upgrade records saved before slug/images/fields existed
  migrate() {
    for (const p of this.data.projects) {
      if (!Array.isArray(p.images)) p.images = p.image ? [p.image] : [];
      if (p.slug == null) p.slug = slugify(p.title);
      p.fields ||= {};
    }
  },

  // newest first; empty/non-numeric years sink to the bottom
  sortByYear() {
    this.data.projects.sort(
      (a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0)
    );
  },

  save() {
    // keep the legacy single-image key in sync so existing site
    // renderers keep working — delete this line once they read images[]
    for (const p of this.data.projects) p.image = p.images[0] || "";
    localStorage.setItem(DRAFT_KEY, JSON.stringify(this.data));
  },

  applyAll() {
    // commit whatever field is still focused/pending, then one save
    document.querySelectorAll("#editor input, #editor textarea, #editor select")
      .forEach((n) => n.dispatchEvent(new Event("change")));
    // duplicate-slug check (warns, still saves — staging model)
    const seen = new Set(), dupes = new Set();
    for (const p of this.data.projects) {
      if (p.slug) (seen.has(p.slug) ? dupes : seen).add(p.slug);
    }
    if (dupes.size) alert(`Duplicate slugs: ${[...dupes].join(", ")}`);
    this.sortByYear();
    this.save();
    this.render(); 
  },

  refreshPreview() {
    const f = $("#preview iframe");
    try {
      f.contentWindow.location.reload();
    } catch {
      f.src = `${ROOT}/index.html?draft=1`;
    }
  },

  export() {
    const files = {
      "projects.json": this.data.projects,
      "projects.schema.json": this.schema
    };
    Object.entries(files).forEach(([name, obj], i) => {
      setTimeout(() => {
        const a = el("a", {
          href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })),
          download: name
        });
        a.click();
        URL.revokeObjectURL(a.href);
      }, i * 400);
    });
  },

  render() {
    const ed = $("#editor");
    ed.innerHTML = "";
    ed.append(this.renderSchema(), this.renderProjects());
  },

  // ---------- custom field definitions ----------
  renderSchema() {
    const box = el("div", { class: "a-slot" });
    box.append(row(
      el("strong", {}, "custom fields"),
      el("span", { class: "a-id" }, "added to every project")
    ));
    this.schema.forEach((def, i) => {
      box.append(row(
        el("span", {}, def.label),
        el("span", { class: "a-id" }, `${def.key} · ${def.type}`),
        el("button", { onclick: () => {
          if (!confirm(`Remove field "${def.label}" and its data from all projects?`)) return;
          this.schema.splice(i, 1);
          for (const p of this.data.projects) delete p.fields[def.key];
          this.render();
        } }, "×")
      ));
    });
    const name = el("input", { placeholder: "field name (e.g. client)" });
    const type = el("select", {}, ...FIELD_TYPES.map((t) => el("option", { value: t }, t)));
    box.append(row(name, type, el("button", { onclick: () => {
      const label = name.value.trim();
      const key = slugify(label);
      if (!key) return;
      if (this.schema.some((d) => d.key === key)) return alert(`Field "${key}" already exists.`);
      this.schema.push({ key, label, type: type.value });
      this.render();
    } }, "+ field")));
    return box;
  },

  // one control per schema definition, typed
  customControl(p, def) {
    const v = p.fields[def.key];
    if (def.type === "textarea") {
      return field(def.label, el("textarea", { rows: 3, value: v || "",
        onchange: (e) => { p.fields[def.key] = e.target.value; } }));
    }
    if (def.type === "list") {
      return field(def.label, el("input", {
        value: Array.isArray(v) ? v.join(", ") : "", placeholder: "comma, separated",
        onchange: (e) => {
          p.fields[def.key] = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
        } }));
    }
    return field(def.label, el("input", { value: v || "",
      onchange: (e) => { p.fields[def.key] = e.target.value; } }));
  },

  // ---------- projects ----------
  renderProjects() {
    const list = (this.data.projects ||= []);
    const panel = el("div", { class: "panel" });

    list.forEach((p, i) => {
      const box = el("div", { class: "a-slot" });
      box.append(
        row(
          el("strong", {}, p.title || `project ${i + 1}`),
          el("span", { class: "a-id" }, p.id || ""),
          el("button", { title: "move up", disabled: i === 0,
            onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; this.render(); } }, "↑"),
          el("button", { onclick: () => {
            if (confirm(`Delete "${p.title || "project"}"?`)) { list.splice(i, 1); this.render(); }
          } }, "×")
        ),
        field("title", el("input", { value: p.title || "",
          onchange: (e) => {
            p.title = e.target.value;
            if (!p.slug) p.slug = slugify(p.title);   // auto-fill, never overwrite
          } })),
        field("slug", el("input", { value: p.slug || "", placeholder: "auto from title",
          onchange: (e) => { p.slug = slugify(e.target.value); e.target.value = p.slug; } })),
        field("year", el("input", { value: p.year || "", size: 8,
          onchange: (e) => { p.year = e.target.value; } })),
        field("tags", el("input", { value: (p.tags || []).join(", "), placeholder: "comma, separated",
          onchange: (e) => {
            p.tags = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
          } })),
        field("url", el("input", { value: "#/project/"+p.slug || "", placeholder: "#/project/"+p.slug,
          onchange: (e) => { p.url = e.target.value; } })),
        field("desc", el("textarea", { rows: 3, value: p.description || "",
          onchange: (e) => { p.description = e.target.value; } }))
      );

      // images: one row per url, reorderable — images[0] is the cover
      const imgs = el("div", { class: "a-slot" });
      imgs.append(row(el("strong", {}, "images"), el("span", { class: "a-id" }, "first = cover")));
      p.images.forEach((src, j) => {
        const thumb = el("img", { class: "a-thumb", src: imgSrc(src),
          onerror: (e) => { e.target.style.visibility = "hidden"; } });
        if (!src) thumb.style.visibility = "hidden";

        const pick = el("input", { type: "file", accept: "image/*", hidden: true,
          onchange: (e) => {
            const f = e.target.files[0];
            if (f) { p.images[j] = `projects/images/${f.name}`; this.render(); }
          } });

        imgs.append(row(
          thumb,
          el("input", { value: src, placeholder: "url",
            onchange: (e) => {
              p.images[j] = e.target.value;
              thumb.style.visibility = "";
              thumb.src = imgSrc(p.images[j]);      // live thumb update, still staged
            } }),
          el("button", { onclick: () => pick.click() }, "browse"),
          pick,
          el("button", { title: "move up", disabled: j === 0,
            onclick: () => { [p.images[j - 1], p.images[j]] = [p.images[j], p.images[j - 1]]; this.render(); } }, "↑"),
          el("button", { onclick: () => { p.images.splice(j, 1); this.render(); } }, "×")
        ));
      });
      imgs.append(row(el("button", { onclick: () => { p.images.push(""); this.render(); } }, "+ image")));
      box.append(imgs);

      // custom fields from the schema
      this.schema.forEach((def) => box.append(this.customControl(p, def)));

      panel.append(box);
    });

    panel.append(row(el("button", { onclick: () => {
      list.push({ id: `p-${Date.now().toString(36)}`, slug: "", title: "", year: "",
                  tags: [], description: "", images: [], url: "", fields: {} });
      this.render();
    } }, "+ project")));

    return panel;
  }
};

Proj.init();
