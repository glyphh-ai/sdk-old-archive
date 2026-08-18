/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * slides/layouts.ts — the LAYOUT REGISTRY.
 *
 * Each layout is a pure `(content, ctx) => innerHTML` function that renders
 * typed content into the inside of a `<section class="slide">`, using the
 * shared base classes + theme vars. The agent supplies STRUCTURED CONTENT and
 * picks a layout; it never authors HTML or CSS. Build-step reveals use the
 * shell's `.frag` mechanism (elements marked `frag` appear on advance).
 */

import type { FieldSchema, LayoutFn, LayoutSpec, RenderCtx, SlideSpec } from "./types.js";
import { esc, s, list, rows, hasMedia } from "./util.js";
import { renderSlideChart, type SlideChartType } from "./chart-svg.js";

// ── small emit helpers ───────────────────────────────────────────────────────
const eyebrow = (v: unknown): string => (s(v) ? `<p class="gp-eyebrow">${esc(v)}</p>` : "");
const rule = (): string => `<div class="gp-rule"></div>`;
/** Reveal-on-advance wrapper (build step i). */
const frag = (i: number, html: string): string => html.replace(/^<(\w+)/, `<$1 class="frag" data-step="${i}"`);

// ── layouts ──────────────────────────────────────────────────────────────────

const title: LayoutFn = (c) => `
<div class="gp-frame center">
  ${eyebrow(c.eyebrow)}
  <h1 class="gp-title lg">${esc(c.title)}</h1>
  ${s(c.subtitle) ? `<p class="gp-sub frag" data-step="1">${esc(c.subtitle)}</p>` : ""}
</div>`;

const sectionDivider: LayoutFn = (c) => `
<div class="gp-frame">
  ${s(c.number) ? `<p class="gp-kicker">${esc(c.number)}</p>` : ""}
  ${rule()}
  <h1 class="gp-title">${esc(c.title)}</h1>
  ${s(c.subtitle) ? `<p class="gp-sub">${esc(c.subtitle)}</p>` : ""}
</div>`;

const bullets: LayoutFn = (c) => {
  const items = list(c.points).map((p, i) => frag(i + 1, `<li>${inline(p)}</li>`)).join("");
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  <h2 class="gp-title sm">${esc(c.title)}</h2>
  <ul class="gp-bullets ${c.style === "check" ? "check" : ""}">${items}</ul>
</div>`;
};

const twoColumn: LayoutFn = (c) => {
  const col = (head: unknown, body: unknown): string => `
    <div class="gp-col">
      ${s(head) ? `<p class="gp-colhead">${esc(head)}</p>` : ""}
      ${colBody(body)}
    </div>`;
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  ${s(c.title) ? `<h2 class="gp-title sm" style="margin-bottom:20px">${esc(c.title)}</h2>` : ""}
  <div class="gp-grid2">
    ${col((c.left as Record<string, unknown>)?.heading ?? c.leftHeading, (c.left as Record<string, unknown>)?.body ?? c.leftBody ?? c.left)}
    ${col((c.right as Record<string, unknown>)?.heading ?? c.rightHeading, (c.right as Record<string, unknown>)?.body ?? c.rightBody ?? c.right)}
  </div>
</div>`;
};

const imageSide = (side: "left" | "right"): LayoutFn => (c, ctx) => {
  const media = mediaBox(c.media ?? c.image, ctx);
  const text = `
    <div class="gp-col">
      ${eyebrow(c.eyebrow)}
      <h2 class="gp-title sm">${esc(c.title)}</h2>
      ${colBody(c.body ?? c.points)}
    </div>`;
  const order = side === "left" ? [media, text] : [text, media];
  return `
<div class="gp-frame" style="padding-block:var(--slide-pad)">
  <div class="gp-grid2 media">${order.join("")}</div>
</div>`;
};

const quote: LayoutFn = (c) => `
<div class="gp-frame">
  <blockquote class="gp-quote"><span class="mark">“</span>${esc(c.quote ?? c.text)}<span class="mark">”</span></blockquote>
  ${s(c.attribution ?? c.author) ? `<p class="gp-cite">— <b>${esc(c.attribution ?? c.author)}</b>${s(c.role) ? `, ${esc(c.role)}` : ""}</p>` : ""}
</div>`;

const bigStat: LayoutFn = (c) => {
  const many = rows(c.stats);
  if (many.length > 1) {
    const cells = many.slice(0, 4).map((st) => `
      <div>
        <p class="gp-stat">${esc(st.stat ?? st.value)}</p>
        <p class="gp-statlabel">${esc(st.label)}</p>
      </div>`).join("");
    return `
<div class="gp-frame">
  ${s(c.title) ? `<h2 class="gp-title sm" style="margin-bottom:20px">${esc(c.title)}</h2>` : ""}
  <div class="gp-stats-row">${cells}</div>
</div>`;
  }
  return `
<div class="gp-frame center">
  <p class="gp-stat">${esc(c.stat ?? c.value)}</p>
  <p class="gp-statlabel">${esc(c.label)}</p>
  ${s(c.caption) ? `<p class="gp-statcap">${esc(c.caption)}</p>` : ""}
</div>`;
};

const cards: LayoutFn = (c) => {
  const items = rows(c.cards ?? c.items);
  const wide = items.length <= 2 && items.length > 0 ? "gp-grid2c" : "gp-grid3";
  const cells = items.slice(0, 6).map((it, i) => frag(i + 1, `
    <div class="gp-card">
      ${s(it.label ?? it.number) ? `<p class="gp-cardnum">${esc(it.label ?? it.number)}</p>` : ""}
      <h3>${esc(it.title ?? it.heading)}</h3>
      ${s(it.body ?? it.text) ? `<p>${esc(it.body ?? it.text)}</p>` : ""}
    </div>`)).join("");
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  ${s(c.title) ? `<h2 class="gp-title sm" style="margin-bottom:44px">${esc(c.title)}</h2>` : ""}
  <div class="${wide}">${cells}</div>
</div>`;
};

const comparison: LayoutFn = (c) => {
  const side = (col: unknown, fallbackHead: unknown, fallbackPts: unknown): string => {
    const o = (col ?? {}) as Record<string, unknown>;
    const head = o.heading ?? o.title ?? fallbackHead;
    const points = o.points ?? o.body ?? fallbackPts;
    const li = list(points).map((p) => `<li>${inline(p)}</li>`).join("");
    return `
      <div class="gp-card" style="gap:26px">
        <h3>${esc(head)}</h3>
        <ul class="gp-bullets" style="margin-top:8px;gap:22px">${li}</ul>
      </div>`;
  };
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  ${s(c.title) ? `<h2 class="gp-title sm" style="margin-bottom:40px">${esc(c.title)}</h2>` : ""}
  <div class="gp-grid2c">
    ${side(c.left, c.leftHeading, c.leftPoints)}
    ${side(c.right, c.rightHeading, c.rightPoints)}
  </div>
</div>`;
};

const timeline: LayoutFn = (c) => {
  const items = rows(c.items ?? c.milestones).slice(0, 5);
  const cells = items.map((it, i) => frag(i + 1, `
    <div class="gp-tl">
      <p class="date">${esc(it.date ?? it.when)}</p>
      <p class="label">${esc(it.label ?? it.title)}</p>
      ${s(it.note ?? it.body) ? `<p class="note">${esc(it.note ?? it.body)}</p>` : ""}
    </div>`)).join("");
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  <h2 class="gp-title sm">${esc(c.title)}</h2>
  <div class="gp-timeline">${cells}</div>
</div>`;
};

const agenda: LayoutFn = (c) => {
  const items = list(c.items ?? c.points);
  const li = items.map((it, i) => {
    const parts = it.split(/\s+—\s+|\s+-\s+/);
    const main = parts[0] ?? it;
    const sub = parts.slice(1).join(" — ");
    return frag(i + 1, `<li>${esc(main)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</li>`);
  }).join("");
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow ?? "Agenda")}
  ${s(c.title) ? `<h2 class="gp-title sm">${esc(c.title)}</h2>` : ""}
  <ol class="gp-agenda">${li}</ol>
</div>`;
};

const chart: LayoutFn = (c) => {
  const type = (["bar", "line", "area", "pie"].includes(String(c.chartType)) ? c.chartType : "bar") as SlideChartType;
  const svg = renderSlideChart(type, c.series ?? c.data ?? c.points);
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  <h2 class="gp-title sm">${esc(c.title)}</h2>
  <div class="gp-chart">${svg || `<p class="gp-sub">No data.</p>`}</div>
  ${s(c.caption) ? `<p class="gp-codecap">${esc(c.caption)}</p>` : ""}
</div>`;
};

const code: LayoutFn = (c) => `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow ?? (s(c.language) ? String(c.language) : ""))}
  ${s(c.title) ? `<h2 class="gp-title sm">${esc(c.title)}</h2>` : ""}
  <pre class="gp-code">${esc(c.code ?? c.body)}</pre>
  ${s(c.caption) ? `<p class="gp-codecap">${esc(c.caption)}</p>` : ""}
</div>`;

const fullBleedImage: LayoutFn = (c, ctx) => {
  const bg = ctx.media(c.media ?? c.image);
  const fill = bg ? `background-image:url(${bg})` : "";
  return `
<div class="gp-fill" style="${fill}"></div>
<div class="gp-scrim"></div>
<div class="gp-frame">
  ${eyebrow(c.eyebrow)}
  <h1 class="gp-title">${esc(c.title)}</h1>
  ${s(c.subtitle) ? `<p class="gp-sub">${esc(c.subtitle)}</p>` : ""}
</div>`;
};

const team: LayoutFn = (c) => {
  const people = rows(c.members ?? c.people).slice(0, 8);
  const cells = people.map((m, i) => {
    const av = m.photo ?? m.avatar ?? m.media;
    // ctx isn't threaded into map easily; use token directly via hasMedia guard
    const bg = hasMedia(av) ? `background-image:url({{MEDIA:${s(av)}}})` : "";
    return frag(i + 1, `
    <div class="gp-member">
      <div class="gp-avatar" style="${bg}"></div>
      <p class="name">${esc(m.name)}</p>
      <p class="role">${esc(m.role ?? m.title)}</p>
    </div>`);
  }).join("");
  return `
<div class="gp-frame top" style="justify-content:center">
  ${eyebrow(c.eyebrow)}
  <h2 class="gp-title sm">${esc(c.title)}</h2>
  <div class="gp-team">${cells}</div>
</div>`;
};

const closing: LayoutFn = (c) => `
<div class="gp-frame center">
  ${rule()}
  <h1 class="gp-title lg">${esc(c.title ?? "Thank you")}</h1>
  ${s(c.subtitle ?? c.contact) ? `<p class="gp-sub">${esc(c.subtitle ?? c.contact)}</p>` : ""}
</div>`;

/** Escape hatch: raw content. Still passes through the structure lock. */
const blank: LayoutFn = (c) => s(c.html) || `<div class="gp-frame center"><p class="gp-sub">Empty slide.</p></div>`;

// ── shared content helpers ───────────────────────────────────────────────────
/** Bold/italic inline markdown → safe HTML (escaped first). */
function inline(v: unknown): string {
  return esc(v)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>");
}

/** A body that may be prose or a bullet list. */
function colBody(v: unknown): string {
  const items = list(v);
  if (Array.isArray(v) && items.length) {
    return `<ul class="gp-bullets" style="margin-top:8px">${items.map((p) => `<li>${inline(p)}</li>`).join("")}</ul>`;
  }
  return s(v) ? `<p class="gp-body gp-lead">${inline(v)}</p>` : "";
}

/** A media box (image element that fills its cell); falls back to a themed
 *  surface when no media is supplied. */
function mediaBox(ref: unknown, ctx: RenderCtx): string {
  const url = ctx.media(ref);
  return url
    ? `<div class="gp-mediabox" style="background-image:url(${url})"></div>`
    : `<div class="gp-mediabox"></div>`;
}

// ── the registry ─────────────────────────────────────────────────────────────
function f(key: string, type: FieldSchema["type"], doc: string, required = false): FieldSchema {
  return { key, type, required, doc };
}

export const SLIDE_LAYOUTS: Record<string, LayoutSpec> = {
  title: {
    name: "title", summary: "Opening / cover slide: big centered title, optional eyebrow + subtitle.",
    render: title,
    schema: [f("title", "text", "The deck's headline.", true), f("subtitle", "text", "One supporting line."), f("eyebrow", "text", "Small label above the title (e.g. company or date).")],
    sample: { layout: "title", eyebrow: "Q3 REVIEW", title: "Building the future of work", subtitle: "How we tripled activation in 90 days" },
  },
  "section-divider": {
    name: "section-divider", summary: "Chapter break: accent rule, big title, optional number + subtitle.",
    render: sectionDivider,
    schema: [f("title", "text", "The section name.", true), f("number", "text", "e.g. '01' or 'Part Two'."), f("subtitle", "text", "One line of context.")],
    sample: { layout: "section-divider", number: "01", title: "The problem", subtitle: "Why the old way breaks down" },
  },
  bullets: {
    name: "bullets", summary: "Title + a list of points that reveal one at a time. **bold**/*italic* allowed.",
    render: bullets,
    schema: [f("title", "text", "Slide heading.", true), f("points", "list", "The bullet points (array of strings).", true), f("eyebrow", "text", "Small label above the title."), f("style", "text", "'check' for checkmark bullets.")],
    sample: { layout: "bullets", title: "What changed", points: ["**Onboarding** cut to 3 steps", "Live preview on every edit", "One-click publish"] },
  },
  "two-column": {
    name: "two-column", summary: "Two side-by-side columns of prose or bullets, each with an optional heading.",
    render: twoColumn,
    schema: [f("title", "text", "Optional slide heading."), f("left", "text", "Left column: {heading?, body} where body is a string or array of bullets."), f("right", "text", "Right column: {heading?, body}.")],
    sample: { layout: "two-column", title: "Before & after", left: { heading: "Before", body: ["Manual exports", "No previews"] }, right: { heading: "After", body: ["Automated", "Live previews"] } },
  },
  "image-left": {
    name: "image-left", summary: "Media on the left, title + body/bullets on the right.",
    render: imageSide("left"),
    schema: [f("title", "text", "Heading.", true), f("body", "text", "Prose or an array of bullets."), f("media", "media", "Media-library asset id for the image."), f("eyebrow", "text", "Small label.")],
    sample: { layout: "image-left", title: "See it in motion", body: "The panel updates the instant an agent writes.", media: "asset_123" },
  },
  "image-right": {
    name: "image-right", summary: "Title + body/bullets on the left, media on the right.",
    render: imageSide("right"),
    schema: [f("title", "text", "Heading.", true), f("body", "text", "Prose or an array of bullets."), f("media", "media", "Media-library asset id."), f("eyebrow", "text", "Small label.")],
    sample: { layout: "image-right", title: "One workspace", body: ["Docs", "Sheets", "Slides"], media: "asset_123" },
  },
  quote: {
    name: "quote", summary: "A large pull-quote with attribution.",
    render: quote,
    schema: [f("quote", "text", "The quotation (no surrounding quotes needed).", true), f("attribution", "text", "Who said it."), f("role", "text", "Their title/company.")],
    sample: { layout: "quote", quote: "This is the tool I didn't know I needed.", attribution: "A happy user", role: "Head of Design" },
  },
  "big-stat": {
    name: "big-stat", summary: "One giant number + label (+caption), OR a row of up to 4 stats.",
    render: bigStat,
    schema: [f("stat", "text", "The headline figure, e.g. '3.4×'."), f("label", "text", "What it measures."), f("caption", "text", "Optional supporting line."), f("stats", "items", "For a row: [{stat, label}] (up to 4).")],
    sample: { layout: "big-stat", stat: "3.4×", label: "faster activation", caption: "Median across 1,200 new teams" },
  },
  cards: {
    name: "cards", summary: "A grid of 2–6 titled cards (feature/step tiles) that reveal in sequence.",
    render: cards,
    schema: [f("title", "text", "Optional heading."), f("cards", "items", "[{label?, title, body?}] — up to 6.", true), f("eyebrow", "text", "Small label.")],
    sample: { layout: "cards", title: "How it works", cards: [{ label: "01", title: "Connect", body: "Link your data" }, { label: "02", title: "Compose", body: "Agents build it" }, { label: "03", title: "Ship", body: "One click" }] },
  },
  comparison: {
    name: "comparison", summary: "Two labelled cards of bullets, side by side (us vs them, before vs after).",
    render: comparison,
    schema: [f("title", "text", "Optional heading."), f("left", "text", "{heading, points[]}."), f("right", "text", "{heading, points[]}.")],
    sample: { layout: "comparison", title: "Why us", left: { heading: "Spreadsheets", points: ["Manual", "Fragile"] }, right: { heading: "Glyphh", points: ["Automated", "Governed"] } },
  },
  timeline: {
    name: "timeline", summary: "A horizontal timeline of up to 5 milestones.",
    render: timeline,
    schema: [f("title", "text", "Heading.", true), f("items", "items", "[{date, label, note?}] — up to 5.", true)],
    sample: { layout: "timeline", title: "Roadmap", items: [{ date: "Q1", label: "Launch", note: "GA" }, { date: "Q2", label: "Teams" }, { date: "Q3", label: "Enterprise" }] },
  },
  agenda: {
    name: "agenda", summary: "A numbered agenda / table of contents. Use ' — ' to add a sub-note per item.",
    render: agenda,
    schema: [f("title", "text", "Optional heading."), f("items", "list", "Agenda entries; 'Topic — note' splits the note out.", true), f("eyebrow", "text", "Label (defaults to 'Agenda').")],
    sample: { layout: "agenda", title: "Today", items: ["The problem — 5 min", "The solution — 10 min", "Demo — 15 min", "Q&A"] },
  },
  chart: {
    name: "chart", summary: "A native (self-contained SVG) chart from inline data — bar/line/area/pie.",
    render: chart,
    schema: [f("title", "text", "Heading.", true), f("chartType", "text", "bar | line | area | pie (default bar)."), f("series", "series", "[{label, value}] data points.", true), f("caption", "text", "Optional source line.")],
    sample: { layout: "chart", title: "Revenue by quarter", chartType: "bar", series: [{ label: "Q1", value: 120 }, { label: "Q2", value: 190 }, { label: "Q3", value: 240 }, { label: "Q4", value: 310 }] },
  },
  code: {
    name: "code", summary: "A monospaced code block with optional title + caption.",
    render: code,
    schema: [f("code", "text", "The code (preserve newlines/indentation).", true), f("title", "text", "Optional heading."), f("language", "text", "Shown as the eyebrow when set."), f("caption", "text", "Optional note under the block.")],
    sample: { layout: "code", title: "Call the API", language: "TypeScript", code: "const deck = await client.officeSlides.get('q3.html');" },
  },
  "full-bleed-image": {
    name: "full-bleed-image", summary: "Edge-to-edge background image with a title overlaid on a scrim.",
    render: fullBleedImage,
    schema: [f("media", "media", "Media-library asset id for the background.", true), f("title", "text", "Overlaid headline.", true), f("subtitle", "text", "Overlaid supporting line."), f("eyebrow", "text", "Small overlaid label.")],
    sample: { layout: "full-bleed-image", media: "asset_bg", title: "Made for teams", subtitle: "From day one" },
  },
  team: {
    name: "team", summary: "A grid of people (photo, name, role) — up to 8.",
    render: team,
    schema: [f("title", "text", "Heading.", true), f("members", "items", "[{name, role, photo?}] where photo is a media asset id.", true)],
    sample: { layout: "team", title: "The team", members: [{ name: "Ada", role: "Engineering" }, { name: "Chris", role: "Product" }] },
  },
  closing: {
    name: "closing", summary: "A closing / thank-you slide with an optional contact line.",
    render: closing,
    schema: [f("title", "text", "Defaults to 'Thank you'."), f("subtitle", "text", "A closing line."), f("contact", "text", "Email / URL / handle.")],
    sample: { layout: "closing", title: "Let's build", contact: "hello@glyphh.ai" },
  },
  blank: {
    name: "blank", summary: "Escape hatch — raw slide HTML when no layout fits (still structure-locked).",
    render: blank,
    schema: [f("html", "richtext", "Raw inner HTML for the section.", true)],
    sample: { layout: "blank", html: "<div class=\"gp-frame center\"><h1 class=\"gp-title\">Custom</h1></div>" },
  },
};

export const LAYOUT_NAMES = Object.keys(SLIDE_LAYOUTS);
