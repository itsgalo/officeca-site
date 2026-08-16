// ============================================
// OFFICE CA SYS admin — edits a draft of {site, layouts, pages}
// in localStorage. Lives in /admin, so all site paths are ../
//
// Editing model:
//   field handlers STAGE into Admin.data (no save)
//   structural buttons RE-RENDER the form (no save)
//   "apply changes" COMMITS: saves the draft + refreshes the preview
// ============================================

const DRAFT_KEY = "quados-draft";
const ROOT = "..";
const $ = (s) => document.querySelector(s);

// module templates inserted by the "add module" dropdown
const SNIPPETS = {
  title: { type: "title", text: "Title", sub: "" },
  paragraph: { type: "paragraph", text: "Text…" },
  typing: { type: "typing", text: "Text…", speed: 18 },
  image: { type: "image", src: "https://picsum.photos/seed/x/800/500", caption: "" },
  links: { type: "links", items: [{ text: "link", href: "#" }] },
  list: { type: "list", items: ["item"] },
  kv: { type: "kv", pairs: [["key", "value"]] },
  projects: { type: "projects", tags: [], limit: 0, columns: 0 },
  "single-project": { type: "single-project", slug: "" },
  "projects-list": { type: "projects-list", sort: "year" },
  slideshow: { type: "slideshow", interval: 3000, caption: "caption...", images: ["image.png", "image.png"]},
  "widget-clock": { type: "widget-clock" }
};

// tiny DOM helper
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k in n && k !== "list") n[k] = v;   // value, checked, selected…
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}
const row = (...kids) => el("div", { class: "a-row" }, ...kids);
const field = (label, control) => el("label", { class: "a-field" }, el("span", {}, label), control);

const Admin = {
  data: null,
  tab: "pages",
  sel: { page: null, layout: null },

  async init() {
    const fetchJSON = (f) => fetch(`${ROOT}/content/${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch content/${f}.json`);
      return r.json();
    });

    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      this.data = JSON.parse(draft);
      delete this.data.projects;   // scrub stale key from drafts saved by the old admin
    } else {
      const [site, layouts, pages] = await Promise.all(
        ["site", "layouts", "pages"].map(fetchJSON)
      );
      this.data = { site, layouts, pages };
      this.save();   // seed the draft so the preview iframe has data
    }

    document.querySelectorAll("#nav [data-tab]").forEach((b) =>
      b.addEventListener("click", () => { this.tab = b.dataset.tab; this.render(); })
    );
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

  // commit the staged data: persist draft, refresh preview
  save() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(this.data));
    this.refreshPreview();
  },

  applyAll() {
    // commit whatever field is still focused/pending, then one save
    document.querySelectorAll("#editor input, #editor textarea, #editor select")
      .forEach((n) => n.dispatchEvent(new Event("change")));
    this.save();   // no form rebuild — textareas keep exactly what you typed
  },

  refreshPreview() {
    const f = $("#preview iframe");
    try {
      f.contentWindow.location.reload();          // reloads current page, hash and all
    } catch {
      f.src = `${ROOT}/index.html?draft=1`;       // fallback: hard reset to home
    }
  },

  export() {
    const files = {
      "site.json": this.data.site,
      "layouts.json": this.data.layouts,
      "pages.json": this.data.pages
    };
    Object.entries(files).forEach(([name, obj], i) => {
      setTimeout(() => {
        const a = el("a", {
          href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })),
          download: name
        });
        a.click();
        URL.revokeObjectURL(a.href);
      }, i * 400);   // staggered so browsers allow all downloads
    });
  },

  render() {
    document.querySelectorAll("#nav [data-tab]").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === this.tab)
    );
    const ed = $("#editor");
    ed.innerHTML = "";
    ed.appendChild({
      pages: this.renderPages,
      layouts: this.renderLayouts,
      site: this.renderSite
    }[this.tab].call(this));
  },

  // ---------- pages ----------
  renderPages() {
    const P = this.data.pages;
    const slugs = Object.keys(P);
    if (!slugs.includes(this.sel.page)) this.sel.page = slugs[0];
    const slug = this.sel.page;
    const page = P[slug];
    const panel = el("div", { class: "panel" });

    const sel = el("select", { onchange: (e) => { this.sel.page = e.target.value; this.render(); } },
      ...slugs.map((s) => el("option", { value: s }, s)));
    sel.value = slug;
    panel.append(row(
      sel,
      el("button", { onclick: () => {
        const s = prompt("page slug (e.g. contact):");
        if (!s || P[s]) return;
        const layout = this.data.layouts[Object.keys(this.data.layouts)[0]];
        P[s] = { title: s, layout: Object.keys(this.data.layouts)[0],
                 slots: layout.slots.map(() => ({ label: "", modules: [] })) };
        this.sel.page = s;
        this.render();
      } }, "+ page"),
      el("button", { onclick: () => {
        if (slugs.length > 1 && confirm(`Delete page "${slug}"?`)) {
          delete P[slug];
          this.render();
        }
      } }, "delete")
    ));

    if (!page) return panel;

    panel.append(
      field("title", el("input", { value: page.title || "",
        onchange: (e) => { page.title = e.target.value; } })),
      field("layout", (() => {
        const s = el("select", { onchange: (e) => { page.layout = e.target.value; } },
          ...Object.keys(this.data.layouts).map((l) => el("option", { value: l }, l)));
        s.value = page.layout;
        return s;
      })())
    );

    (page.slots || []).forEach((slot, i) => {
      const box = el("div", { class: "a-slot" });
      box.append(row(
        el("strong", {}, `slot ${i + 1}`),
        el("input", { value: slot.label || "", placeholder: "label",
          onchange: (e) => { slot.label = e.target.value; } }),
        field("2 cols", el("input", { type: "checkbox", checked: slot.columns === 2,
          onchange: (e) => { e.target.checked ? slot.columns = 2 : delete slot.columns; } })),
        el("button", { onclick: () => { page.slots.splice(i, 1); this.render(); } }, "×")
      ));

      // modules: raw json + snippet inserter. parse stages; invalid json stages nothing.
      const ta = el("textarea", { spellcheck: false, rows: Math.min(14, 3 + (slot.modules || []).length * 3),
        value: JSON.stringify(slot.modules || [], null, 2),
        onchange: (e) => {
          try {
            slot.modules = JSON.parse(e.target.value);
            e.target.classList.remove("bad");
          } catch {
            e.target.classList.add("bad");
          }
        } });
      const adder = el("select", { onchange: (e) => {
        if (!e.target.value) return;
        (slot.modules ||= []).push(structuredClone(SNIPPETS[e.target.value]));
        this.render();
      } }, el("option", { value: "" }, "add module…"),
         ...Object.keys(SNIPPETS).map((t) => el("option", { value: t }, t)));
      box.append(ta, row(adder));
      panel.append(box);
    });

    panel.append(row(el("button", { onclick: () => {
      (page.slots ||= []).push({ label: "", modules: [] });
      this.render();
    } }, "+ slot")));

    return panel;
  },

  // ---------- layouts ----------
  renderLayouts() {
    const L = this.data.layouts;
    const names = Object.keys(L);
    if (!names.includes(this.sel.layout)) this.sel.layout = names[0];
    const name = this.sel.layout;
    const layout = L[name];
    const panel = el("div", { class: "panel" });

    const sel = el("select", { onchange: (e) => { this.sel.layout = e.target.value; this.render(); } },
      ...names.map((n) => el("option", { value: n }, n)));
    sel.value = name;
    panel.append(row(
      sel,
      el("button", { onclick: () => {
        const n = prompt("layout name (e.g. triptych):");
        if (!n || L[n]) return;
        L[n] = { grid: "1fr / 1fr 1fr", slots: [{}, {}] };
        this.sel.layout = n;
        this.render();
      } }, "+ layout"),
      el("button", { onclick: () => {
        const used = Object.values(this.data.pages).some((p) => p.layout === name);
        if (used) return alert(`"${name}" is used by a page — switch those pages first.`);
        if (names.length > 1 && confirm(`Delete layout "${name}"?`)) {
          delete L[name];
          this.render();
        }
      } }, "delete")
    ));

    if (!layout) return panel;

    panel.append(
      field("grid-template (rows / cols)", el("input", { value: layout.grid,
        onchange: (e) => { layout.grid = e.target.value; } })),
      field("center mark", el("input", { type: "checkbox", checked: !!layout.mark,
        onchange: (e) => { e.target.checked ? layout.mark = true : delete layout.mark; } }))
    );

    (layout.slots || []).forEach((slot, i) => {
      panel.append(row(
        el("strong", {}, `slot ${i + 1} defaults`),
        field("2 cols", el("input", { type: "checkbox", checked: slot.columns === 2,
          onchange: (e) => { e.target.checked ? slot.columns = 2 : delete slot.columns; } })),
        el("button", { onclick: () => { layout.slots.splice(i, 1); this.render(); } }, "×")
      ));
    });
    panel.append(row(el("button", { onclick: () => {
      (layout.slots ||= []).push({});
      this.render();
    } }, "+ slot")));

    return panel;
  },

  // ---------- site ----------
  renderSite() {
    const S = this.data.site;
    const panel = el("div", { class: "panel" });
    panel.append(field("site title", el("input", { value: S.title || "",
      onchange: (e) => { S.title = e.target.value; } })));

    (S.nav || []).forEach((item, i) => {
      panel.append(row(
        el("input", { value: item.path, placeholder: "/path",
          onchange: (e) => { item.path = e.target.value; } }),
        el("input", { value: item.label, placeholder: "label",
          onchange: (e) => { item.label = e.target.value; } }),
        el("button", { onclick: () => { S.nav.splice(i, 1); this.render(); } }, "×")
      ));
    });
    panel.append(row(el("button", { onclick: () => {
      (S.nav ||= []).push({ path: "/new", label: "new" });
      this.render();
    } }, "+ nav link")));

    return panel;
  }
};

Admin.init();