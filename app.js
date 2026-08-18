// ============================================
// OFFICE CA WEB SYSTEM — pages are states, layouts are templates, modules are data
// ============================================

const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, RM ? 0 : ms));

// --------------------------------------------
// Module renderers (unchanged API: type -> DOM node)
// --------------------------------------------
const renderers = {
  title(m) {
    const el = document.createElement("header");
    el.className = "m-title";
    el.innerHTML = `<h2>${m.text}</h2>` + (m.sub ? `<p>${m.sub}</p>` : "");
    return el;
  },

  paragraph(m) {
    const el = document.createElement("p");
    el.className = "m-paragraph";
    el.textContent = m.text;
    return el;
  },

  typing(m) {
    const el = document.createElement("p");
    el.className = "m-paragraph m-typing";
    el.innerHTML = `<span></span><span class="caret">▌</span>`;
    const out = el.firstChild;
    const speed = m.speed || 18;                 // ms per character
    let i = 0, id;

    requestAnimationFrame(() => {               // runs after cascadeIn assigned --d
      if (RM) {                                  // reduced motion: instant text
        out.textContent = m.text;
        el.querySelector(".caret").remove();
        return;
      }
      const delay = parseFloat(getComputedStyle(el).getPropertyValue("--d")) || 0;
      id = setTimeout(function type() {
        out.textContent = m.text.slice(0, ++i);
        if (i < m.text.length) id = setTimeout(type, speed + Math.random() * 30);
      }, delay + 400);
    });

    App.cleanup.push(() => clearTimeout(id));    // stop if user navigates mid-type
    return el;
  },

  image(m) {
    const el = document.createElement("figure");
    el.className = "m-image";
    el.innerHTML = `<img src="${m.src}" alt="${m.alt || ""}">` +
      (m.caption ? `<figcaption>${m.caption}</figcaption>` : "");
    return el;
  },

  slideshow(m) {
    const el = document.createElement("figure");
    el.className = "m-slideshow";
    const images = m.images || [];
    if (!images.length) {
      el.innerHTML = `<span class="m-unknown">[no images]</span>`;
      return el;
    }

    el.innerHTML = images.map((src, i) =>
      `<img src="${src}" alt="" class="${i === 0 ? "active" : ""}" loading="lazy">`
    ).join("") + (m.caption ? `<figcaption>${m.caption}</figcaption>` : "");

    const imgs = el.querySelectorAll("img");
    let i = 0;
    const id = setInterval(() => {
      imgs[i].classList.remove("active");
      i = (i + 1) % imgs.length;
      imgs[i].classList.add("active");
    }, m.interval || 4000);

    App.cleanup.push(() => clearInterval(id));   // same pattern as the clock module
    return el;
  },

  iframe(m) {
    const el = document.createElement("div");
    el.className = "m-iframe";
    const f = document.createElement("iframe");
    f.src = m.src[Math.floor(Math.random() * m.src.length)];
    f.title = m.title || "";
    f.loading = "lazy";
    if (m.allow) f.allow = m.allow;           // e.g. "fullscreen; autoplay"
    el.appendChild(f);
    return el;
  },

  links(m) {
    const el = document.createElement("ul");
    el.className = "m-links";
    for (const it of m.items) {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${it.href}">${it.text}</a>`;
      el.appendChild(li);
    }
    return el;
  },

  list(m) {
    const el = document.createElement("ul");
    el.className = "m-list";
    for (const it of m.items) {
      const li = document.createElement("li");
      li.textContent = it;
      el.appendChild(li);
    }
    return el;
  },

  kv(m) {
    const el = document.createElement("dl");
    el.className = "m-kv";
    for (const [k, v] of m.pairs) {
      el.innerHTML += `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    }
    return el;
  },

  // renders from the projects database; optional tag filter and limit
  projects(m) {
    const el = document.createElement("div");
    el.className = "m-projects";
    if (m.columns === 2) el.classList.add("p-cols");
    let items = App.projects || [];
    if (m.tags?.length) items = items.filter((p) => p.tags?.some((t) => m.tags.includes(t)));
    if (m.limit) items = items.slice(0, m.limit);
    for (const p of items) {
      const a = document.createElement("article");
      a.style.setProperty("--hue", `${Math.floor(Math.random()*300)+'deg'}`);
      a.innerHTML =
        (p.image ? `<img src="${p.image}" alt="${p.title || ""}" loading="lazy">` : "") +
        `<div class="p-head"><h3>${p.url ? `<a href="${p.url}">${p.title}</a>` : p.title || ""}</h3>` +
        `<span>${p.year || ""}</span></div>` +
        (p.tags?.length ? `<div class="p-tags">${p.tags.join(" / ")}</div>` : "") +
        (p.description ? `<p>${p.description}</p>` : "");
      el.appendChild(a);
    }
    if (!items.length) el.innerHTML = `<span class="m-unknown">[no projects match]</span>`;
    return el;
  },

  "projects-list"(m) {
    const el = document.createElement("div");
    el.className = "m-projects-list";
    el.innerHTML = `<div class="pl-sort"><span>sort:</span>
      <button data-sort="year" class="active">year</button>
      <button data-sort="tag">tag</button></div>
      <ul class="pl-items"></ul>`;

    const list = el.querySelector(".pl-items");

    const draw = (mode) => {
      const items = [...(App.projects || [])];
      if (mode === "year") {
        items.sort((a, b) => (b.year || "").localeCompare(a.year || ""));   // newest first
      } else {
        items.sort((a, b) => (a.tags?.[0] || "~").localeCompare(b.tags?.[0] || "~"));  // "~" sorts untagged last
      }
      list.innerHTML = "";
      for (const p of items) {
        const li = document.createElement("li");
        li.innerHTML =
          `<span class="pl-year">${p.year || ""}</span>` +
          `<span class="pl-title">${p.url ? `<a href="${p.url}">${p.title}</a>` : p.title || ""}</span>` +
          `<span class="pl-tags">${p.tags?.join(" / ") || ""}</span>`;
        list.appendChild(li);
      }
      if (!items.length) list.innerHTML = `<li class="m-unknown">[no projects]</li>`;
    };

    el.querySelector(".pl-sort").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      el.querySelectorAll(".pl-sort button").forEach((b) =>
        b.classList.toggle("active", b === btn));
      draw(btn.dataset.sort);
    });

    draw(m.sort || "year");   // initial sort, overridable from page JSON
    return el;
  },

  // full-quadrant project view: image carousel with data overlaid
  "single-project"(m) {
    const el = document.createElement("article");
    el.className = "m-single-project";
    const key = m.slug || App.param;
    const p = (App.projects || []).find((x) => x.slug === key || x.id === key);
    if (!p) {
      el.innerHTML = `<span class="m-unknown">[no project "${key || "?"}"]</span>`;
      return el;
    }
    const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
    const fields = Object.entries(p.fields || {});

    el.innerHTML =
      images.map((src, i) =>
        `<img src="${src}" alt="" class="${i === 0 ? "active" : ""}" loading="lazy">`
      ).join("") +
      (images.length > 1
        ? `<div class="sp-nav">
            <button class="sp-prev" aria-label="previous image">←</button>
            <span class="sp-count">1/${images.length}</span>
            <button class="sp-next" aria-label="next image">→</button>
          </div>`
        : "") +
      `<div class="sp-info">
        <div class="p-head">
          <h3>${p.url ? `<a href="${p.url}">${p.title}</a>` : p.title || ""}</h3>
          <span>${p.year || ""}</span>
        </div>
        <div class="p-tags">${(p.tags || []).join(" / ")}</div>
        <p>${p.description || ""}</p>` +
        (fields.length
          ? `<dl class="p-fields">${fields.map(([k, v]) =>
              `<div><dt>${k.replace(/-/g, " ")}</dt><dd>${Array.isArray(v) ? v.join(", ") : v ?? ""}</dd></div>`
            ).join("")}</dl>`
          : "") +
      `</div>`;

    if (images.length > 1) {
      const imgs = el.querySelectorAll("img");
      const count = el.querySelector(".sp-count");
      let i = 0;
      const go = (d) => {
        imgs[i].classList.remove("active");
        i = (i + d + imgs.length) % imgs.length;
        imgs[i].classList.add("active");
        count.textContent = `${i + 1}/${imgs.length}`;
      };
      el.querySelector(".sp-prev").addEventListener("click", () => go(-1));
      el.querySelector(".sp-next").addEventListener("click", () => go(1));
    }
    return el;
  },

  "widget-clock"() {
    const el = document.createElement("div");
    el.className = "m-clock";
    const tick = () => { el.textContent = new Date().toLocaleTimeString(); };
    tick();
    const id = setInterval(tick, 1000);
    App.cleanup.push(() => clearInterval(id));   // cleared on page transition
    return el;
  }
};

function renderModule(m) {
  const fn = renderers[m.type];
  const el = fn ? fn(m) : Object.assign(document.createElement("div"), {
    className: "m-unknown",
    textContent: `[no renderer: ${m.type}]`
  });
  if (m.span === 2) el.classList.add("span-2");
  return el;
}

function renderQuadrant(slot, i) {
  const el = document.createElement("section");
  el.className = "quadrant";
  el.innerHTML = `<div class="q-bar"><span>${slot.label || location.hash}</span><span>0${i + 1}</span></div>`;
  const body = document.createElement("div");
  body.className = "q-body";
  if (slot.columns === 2) body.classList.add("cols-2");
  for (const m of slot.modules || []) body.appendChild(renderModule(m));
  el.appendChild(body);
  return el;
}

// --------------------------------------------
// Boot / exit choreography
// --------------------------------------------
function cascadeIn(root) {
  root.querySelectorAll(".quadrant").forEach((q, qi) => {
    q.style.setProperty("--d", `${qi * 140}ms`);
    q.querySelectorAll(".q-body > *").forEach((m, mi) => {
      m.style.setProperty("--d", `${350 + qi * 140 + mi * 110 + Math.random() * 80}ms`);
    });
  });
}

async function cascadeOut(root) {
  const quads = [...root.querySelectorAll(".quadrant")];
  if (!quads.length || RM) return;
  quads.forEach((q, i) => q.style.setProperty("--d", `${i * 60}ms`));
  root.classList.add("leaving");
  await wait(quads.length * 60 + 320);
}

// --------------------------------------------
// App: content loading, routing, state transitions
// --------------------------------------------
const App = {
  config: null,
  layouts: null,
  pages: null,
  cleanup: [],
  grid: document.getElementById("grid"),
  mark: document.getElementById("mark"),
  busy: false,

  async init() {
    try {
      let config, layouts, pages, projects;
      const draft = new URLSearchParams(location.search).has("draft") &&
        localStorage.getItem("quados-draft");
      if (draft) {
        ({ site: config, layouts, pages, projects } = JSON.parse(draft));   // admin preview mode
      } else {
        [config, layouts, pages, projects] = await Promise.all([
          this.fetchJSON("content/site.json"),
          this.fetchJSON("content/layouts.json"),
          this.fetchJSON("content/pages.json"),
          this.fetchJSON("content/projects.json")
        ]);
      }
      Object.assign(this, { config, layouts, pages, projects: projects || [] });
      document.title = config.title || "Site";
      this.renderNav();
      addEventListener("hashchange", () => this.route());
      this.route();
    } catch (err) {
      console.error("Failed to initialize:", err);
      this.grid.innerHTML = `<div class="error">Failed to load site content. Serve over http, not file://</div>`;
    }
  },

  async fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return res.json();
  },

  slug() {
    const segs = (location.hash.slice(1) || "/")
      .replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    this.param = segs[1] ? decodeURIComponent(segs[1]) : null;
    return segs[0] || "home";
  },

  async route() {
    if (this.busy) return;
    this.busy = true;
    const startHash = location.hash;

    const slug = this.slug();
    const page = this.pages[slug] || {
      title: "Not Found",
      layout: "full",
      slots: [{ label: "404", modules: [
        { type: "title", text: "404" },
        { type: "links", items: [{ text: "go home", href: "#/" }] }
      ]}]
    };

    this.setActiveLink(slug);
    await cascadeOut(this.grid);
    this.renderPage(page);

    this.busy = false;
    if (location.hash !== startHash) this.route();
    // if (this.slug() !== slug) this.route();   // user navigated mid-transition
  },

  renderPage(page) {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.grid.classList.remove("leaving");

    const layout = this.layouts[page.layout] || this.layouts.full;
    this.grid.style.setProperty("--layout", layout.grid);
    this.mark.hidden = !layout.mark;

    this.grid.innerHTML = "";
    (page.slots || []).forEach((slot, i) => {
      const merged = { ...(layout.slots[i] || {}), ...slot };   // layout defaults, page overrides
      this.grid.appendChild(renderQuadrant(merged, i));
    });

    document.title = page.title ? `${page.title} | ${this.config.title}` : this.config.title;
    cascadeIn(this.grid);
  },

  renderNav() {
    const links = (this.config.nav || []).map((n) =>
      `<a href="#${n.path}" data-slug="${n.path.replace(/^\/+|\/+$/g, "") || "home"}">${n.label}</a>`
    ).join("");
    document.getElementById("nav").innerHTML =
      `<span class="nav-title">${this.config.title || ""}</span><nav>${links}</nav>`;
  },

  setActiveLink(slug) {
    document.querySelectorAll("#nav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.slug === slug);
    });
  }
};

App.init();
