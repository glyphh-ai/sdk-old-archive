/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * slides/base-css.ts — the shared component stylesheet every layout renders
 * against. The engine prepends this ONCE per deck (inside #stage, ahead of the
 * first section, so the structure lock leaves it intact). Layouts emit semantic
 * classes (.gp-title, .gp-bullets, …); this sheet + the theme's `--slide-*`
 * vars turn them into the finished, "visually sick" look — no per-slide CSS,
 * no agent HTML.
 *
 * Everything is sized for the fixed 1920×1080 stage.
 */

export const SLIDE_BASE_CSS = `
.gp-frame{position:absolute;inset:0;padding:var(--slide-pad);display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}
.gp-frame.center{align-items:center;justify-content:center;text-align:center}
.gp-frame.top{justify-content:flex-start}
.gp-eyebrow{font:600 26px/1 var(--slide-font-body);letter-spacing:.2em;text-transform:uppercase;color:var(--slide-accent);margin:0 0 30px}
.gp-title{font:700 104px/1.03 var(--slide-font-display);letter-spacing:-.025em;margin:0;color:var(--slide-fg)}
.gp-title.sm{font-size:74px}
.gp-title.lg{font-size:150px}
.gp-sub{font:400 34px/1.42 var(--slide-font-body);color:var(--slide-muted);margin:32px 0 0;max-width:1300px}
.gp-frame.center .gp-sub{margin-left:auto;margin-right:auto}
.gp-body{font:400 33px/1.5 var(--slide-font-body);color:var(--slide-fg);margin:0;max-width:900px}
.gp-lead{font:400 40px/1.42 var(--slide-font-body);color:var(--slide-fg);margin:0;max-width:1000px}
.gp-muted{color:var(--slide-muted)}
.gp-accent{color:var(--slide-accent)}
.gp-rule{width:120px;height:6px;border-radius:3px;background:var(--slide-accent);margin:0 0 44px}
.gp-frame.center .gp-rule{margin-left:auto;margin-right:auto}
.gp-kicker{font:700 30px/1 var(--slide-font-mono);color:var(--slide-accent);margin:0 0 34px;letter-spacing:.04em}

.gp-bullets{list-style:none;margin:48px 0 0;padding:0;display:flex;flex-direction:column;gap:32px}
.gp-bullets li{position:relative;padding-left:56px;font:400 40px/1.38 var(--slide-font-body);color:var(--slide-fg)}
.gp-bullets li b,.gp-bullets li strong{font-weight:700}
.gp-bullets li::before{content:"";position:absolute;left:0;top:.5em;width:22px;height:22px;border-radius:7px;background:var(--slide-accent)}
.gp-bullets.check li::before{border-radius:50%;background:none;box-shadow:inset 0 0 0 4px var(--slide-accent)}

.gp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:72px;flex:1;align-items:center;min-height:0}
.gp-grid2.media{grid-template-columns:1.05fr .95fr}
.gp-col{display:flex;flex-direction:column;justify-content:center;gap:22px;min-width:0}
.gp-colhead{font:700 30px/1 var(--slide-font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--slide-accent);margin:0 0 8px}

.gp-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:44px;flex:1;align-items:stretch;min-height:0}
.gp-grid2c{display:grid;grid-template-columns:repeat(2,1fr);gap:48px;flex:1;align-items:stretch;min-height:0}
.gp-card{background:var(--slide-surface);border:1px solid var(--slide-border);border-radius:var(--slide-radius);padding:52px;display:flex;flex-direction:column;gap:18px}
.gp-card .gp-cardnum{font:700 30px/1 var(--slide-font-mono);color:var(--slide-accent)}
.gp-card h3{font:700 42px/1.08 var(--slide-font-display);margin:0;color:var(--slide-fg)}
.gp-card p{font:400 28px/1.46 var(--slide-font-body);color:var(--slide-muted);margin:0}

.gp-stat{font:800 clamp(180px,20vw,320px)/.86 var(--slide-font-display);letter-spacing:-.04em;color:var(--slide-accent);margin:0}
.gp-statlabel{font:600 48px/1.16 var(--slide-font-display);margin:18px 0 0;color:var(--slide-fg)}
.gp-statcap{font:400 32px/1.4 var(--slide-font-body);color:var(--slide-muted);margin:20px 0 0;max-width:1100px}
.gp-stats-row{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:56px;flex:1;align-items:center}
.gp-stats-row .gp-stat{font-size:clamp(120px,12vw,180px)}
.gp-stats-row .gp-statlabel{font-size:34px}

.gp-quote{font:500 74px/1.24 var(--slide-font-display);letter-spacing:-.02em;margin:0;max-width:1560px;color:var(--slide-fg)}
.gp-quote .mark{color:var(--slide-accent)}
.gp-cite{font:500 34px/1.3 var(--slide-font-body);color:var(--slide-muted);margin:56px 0 0}
.gp-cite b{color:var(--slide-fg);font-weight:600}

.gp-media{border-radius:var(--slide-radius);overflow:hidden;background:var(--slide-surface);width:100%;height:100%;min-height:520px;object-fit:cover;display:block}
.gp-mediabox{border-radius:var(--slide-radius);overflow:hidden;background:var(--slide-surface) center/cover no-repeat;width:100%;height:100%;min-height:520px}
.gp-fill{position:absolute;inset:0;background:var(--slide-surface) center/cover no-repeat}
.gp-scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--slide-bg) 4%,rgba(0,0,0,.05) 62%,transparent)}
.gp-scrim.bottom{background:linear-gradient(0deg,var(--slide-bg) 2%,transparent 55%)}

.gp-agenda{list-style:none;margin:48px 0 0;padding:0;counter-reset:a;display:flex;flex-direction:column;gap:6px;flex:1;justify-content:center}
.gp-agenda li{display:flex;gap:38px;align-items:baseline;font:500 50px/1.15 var(--slide-font-display);color:var(--slide-fg);border-bottom:1px solid var(--slide-border);padding:26px 0}
.gp-agenda li::before{counter-increment:a;content:counter(a,decimal-leading-zero);font:700 34px/1 var(--slide-font-mono);color:var(--slide-accent);min-width:70px}
.gp-agenda li .sub{font:400 28px/1 var(--slide-font-body);color:var(--slide-muted);margin-left:auto}

.gp-timeline{display:flex;gap:0;flex:1;align-items:stretch;margin-top:56px}
.gp-tl{flex:1;position:relative;padding-top:60px}
.gp-tl::before{content:"";position:absolute;top:16px;left:0;right:0;height:3px;background:var(--slide-border)}
.gp-tl::after{content:"";position:absolute;top:6px;left:0;width:24px;height:24px;border-radius:50%;background:var(--slide-accent);box-shadow:0 0 0 8px var(--slide-bg)}
.gp-tl .date{font:700 30px/1 var(--slide-font-mono);color:var(--slide-accent);margin:0 0 14px}
.gp-tl .label{font:600 36px/1.18 var(--slide-font-display);color:var(--slide-fg);margin:0;padding-right:30px}
.gp-tl .note{font:400 26px/1.4 var(--slide-font-body);color:var(--slide-muted);margin:12px 30px 0 0}

.gp-code{background:var(--slide-surface);border:1px solid var(--slide-border);border-radius:var(--slide-radius);padding:48px 56px;font:500 30px/1.62 var(--slide-font-mono);white-space:pre;overflow:hidden;color:var(--slide-fg);margin:44px 0 0}
.gp-codecap{font:400 28px/1.4 var(--slide-font-body);color:var(--slide-muted);margin:26px 0 0}

.gp-team{display:grid;grid-template-columns:repeat(4,1fr);gap:48px;flex:1;align-items:center;margin-top:40px}
.gp-member{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
.gp-avatar{width:220px;height:220px;border-radius:50%;background:var(--slide-surface) center/cover no-repeat;border:2px solid var(--slide-border);margin-bottom:16px}
.gp-member .name{font:700 34px/1.15 var(--slide-font-display);color:var(--slide-fg);margin:0}
.gp-member .role{font:400 26px/1.3 var(--slide-font-body);color:var(--slide-muted);margin:0}

.gp-chart{display:flex;flex-direction:column;flex:1;margin-top:40px;min-height:0}
.gp-chart svg{width:100%;height:100%;flex:1;overflow:visible}
.gp-legend{display:flex;gap:36px;flex-wrap:wrap;margin-top:26px}
.gp-legend span{font:500 28px/1 var(--slide-font-body);color:var(--slide-muted);display:flex;align-items:center;gap:12px}
.gp-legend i{width:22px;height:22px;border-radius:6px;display:inline-block}

.gp-tag{display:inline-flex;align-items:center;gap:12px;align-self:flex-start;background:var(--slide-surface);border:1px solid var(--slide-border);border-radius:999px;padding:12px 26px;font:600 26px/1 var(--slide-font-body);color:var(--slide-muted);margin:0 0 34px}
.gp-tag b{color:var(--slide-accent);font-weight:700}
.gp-footer{position:absolute;left:var(--slide-pad);right:var(--slide-pad);bottom:56px;display:flex;justify-content:space-between;align-items:center;font:500 26px/1 var(--slide-font-body);color:var(--slide-muted)}
`.trim();
