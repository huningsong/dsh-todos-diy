/**
 * Client styles.
 *
 * Theme tokens only (`--dsw-alias-*`): a literal colour would be unreadable in
 * the other DSH theme (UX-17 / F8.7). The one exception is nothing — even the
 * priority dots and the pinned tint are derived from tokens.
 */

/** Stylesheet text injected once per client mount. */
export const CSS = `
.dtd-page{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;overflow:hidden}

/* ── header ─────────────────────────────────────────────── */
.dtd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:28px clamp(20px,4vw,48px) 0}
.dtd-head h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dtd-head p{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dtd-actions{display:flex;align-items:center;gap:8px;flex:none}
.dtd-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border:0;border-radius:16px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);font:inherit;font-size:13px;cursor:pointer}
.dtd-btn:hover{background:var(--dsw-alias-button-primary-hover)}
.dtd-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dtd-btn.ghost{background:0 0;color:var(--dsw-alias-label-secondary);border:.5px solid var(--dsw-alias-border-l3)}
.dtd-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dtd-btn.small{height:26px;padding:0 10px;font-size:12px;border-radius:13px}
.dtd-btn:disabled{opacity:.5;cursor:default}

/* ── tabs ───────────────────────────────────────────────── */
.dtd-tabs{display:flex;align-items:center;gap:24px;padding:0 clamp(20px,4vw,48px);margin-top:18px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
.dtd-tab{position:relative;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0;border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;cursor:pointer}
.dtd-tab:hover{color:var(--dsw-alias-label-secondary)}
.dtd-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);font-weight:500}
.dtd-tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-.5px;height:2px;border-radius:2px;background:var(--dsw-alias-label-primary)}
.dtd-count{min-width:18px;height:18px;padding:0 6px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center}

/* ── rule strip ─────────────────────────────────────────── */
.dtd-rules{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:10px clamp(20px,4vw,48px);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;border-bottom:.5px solid var(--dsw-alias-border-l4)}
.dtd-rules b{font-weight:500;color:var(--dsw-alias-label-secondary)}
.dtd-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:1px}
.dtd-dot.high{background:var(--dsw-alias-state-error-primary)}
.dtd-dot.mid{background:var(--dsw-alias-state-warn-primary)}
.dtd-dot.low{background:var(--dsw-alias-state-business-primary)}
.dtd-dot.none{background:var(--dsw-alias-label-caption)}
.dtd-rules .refresh{margin-left:auto}

/* ── toolbar ────────────────────────────────────────────── */
.dtd-toolbar{display:flex;align-items:center;gap:10px;padding:14px clamp(20px,4vw,48px) 6px}
.dtd-search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;color:var(--dsw-alias-label-tertiary)}
.dtd-search:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.dtd-search input{flex:1;min-width:0;border:0;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dtd-search input::placeholder{color:var(--dsw-alias-label-caption)}

/* ── body ───────────────────────────────────────────────── */
.dtd-body{flex:1;min-height:0;overflow:auto;padding:8px clamp(20px,4vw,48px) 48px}
.dtd-group{margin-top:14px}
.dtd-groupHead{display:flex;align-items:baseline;gap:8px;padding:0 4px 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dtd-groupHead b{font-weight:500;color:var(--dsw-alias-label-secondary)}
.dtd-groupHead .n{color:var(--dsw-alias-label-caption)}
.dtd-groupHead .hint{margin-left:auto;color:var(--dsw-alias-label-caption)}
.dtd-rows{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.dtd-groupMore{display:flex;justify-content:center;padding:6px 0 2px}
.dtd-groupMore .dtd-btn{color:var(--dsw-alias-label-secondary)}

/* ── row ────────────────────────────────────────────────── */
.dtd-row{position:relative;display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer}
.dtd-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dtd-row.pinned{background:var(--dsw-alias-state-warn-tertiary)}
.dtd-row.pinned:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}
.dtd-check{flex:none;width:18px;height:18px;margin-top:4px;border:1.5px solid var(--dsw-alias-border-l3);border-radius:50%;background:0 0;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption)}
.dtd-check:hover{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.dtd-check:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dtd-rowMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dtd-rowTitle{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-weight:500;line-height:23px}
.dtd-rowTitle .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.dtd-rowSub{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px}
.dtd-rowSub .sep{color:var(--dsw-alias-label-caption)}
.dtd-rowRight{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;text-align:right}
.dtd-rowRight .big{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}
.dtd-rowRight .overdue{color:var(--dsw-alias-state-error-primary);font-weight:500}
.dtd-rowActions{display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);align-items:center;gap:2px;padding:2px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-stroke-color,0 0 0 .5px var(--dsw-alias-border-l3))}
.dtd-row:hover .dtd-rowActions,.dtd-row:focus-within .dtd-rowActions{display:flex}
.dtd-iconBtn{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;padding:0}
.dtd-iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dtd-iconBtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dtd-iconBtn.danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}

/* ── badges ─────────────────────────────────────────────── */
.dtd-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:6px;font-size:11px;line-height:18px;font-weight:400;white-space:nowrap}
.dtd-badge.high{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}
.dtd-badge.mid{background:var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-state-warn-label)}
.dtd-badge.low{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.dtd-badge.none{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.dtd-badge.paused{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
.dtd-badge.overdue{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}
.dtd-badge.pinned{background:var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-state-warn-label)}
.dtd-badge.kind{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}

/* ── empty / loading / error ────────────────────────────── */
.dtd-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:300px;text-align:center;color:var(--dsw-alias-label-tertiary);padding:32px 20px}
.dtd-center h2{margin:0;font-size:15px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.dtd-center p{margin:0;font-size:13px;line-height:22px;max-width:460px}
.dtd-center .glyph{color:var(--dsw-alias-label-caption);margin-bottom:4px}
.dtd-examples{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}
.dtd-example{width:220px;padding:12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-layer-1);text-align:left;cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.dtd-example:hover{border-color:var(--dsw-alias-state-business-primary)}
.dtd-example small{display:block;margin-top:6px;color:var(--dsw-alias-label-caption);font-size:11px}
.dtd-skeleton{display:flex;flex-direction:column;gap:8px;padding:8px 4px}
.dtd-skeleton span{display:block;height:44px;border-radius:12px;background:var(--dsw-alias-bg-skeleton);animation:dtd-pulse 1.4s ease-in-out infinite}
@keyframes dtd-pulse{0%,100%{opacity:.55}50%{opacity:1}}

/* ── modal ──────────────────────────────────────────────── */
.dtd-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1)}
.dtd-modal{width:min(720px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;border-radius:18px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px var(--dsw-alias-bg-mask-3));overflow:hidden}
.dtd-modalHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 10px}
.dtd-modalHead h2{margin:0;font-size:16px;font-weight:500}
.dtd-modalBody{flex:1;min-height:0;overflow:auto;padding:4px 20px 8px}
.dtd-modalFoot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px 18px;border-top:.5px solid var(--dsw-alias-border-l4)}
.dtd-field{display:flex;flex-direction:column;gap:6px;margin:14px 0}
.dtd-label{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dtd-hint{color:var(--dsw-alias-label-caption);font-size:11.5px;line-height:17px}
.dtd-input,.dtd-select,.dtd-textarea{width:100%;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:7px 10px;outline:none}
.dtd-input:focus,.dtd-select:focus,.dtd-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtd-textarea{min-height:76px;resize:vertical}
.dtd-row2{display:flex;gap:12px}
.dtd-row2>*{flex:1;min-width:0}
.dtd-segment{display:flex;flex-wrap:wrap;gap:6px}
.dtd-seg{height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer}
.dtd-seg:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-seg[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}
.dtd-filters{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:10px clamp(20px,4vw,48px) 0}
.dtd-filtersLabel{flex:none;margin-right:2px;font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dtd-chip{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:14px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:1;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}
.dtd-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-chip[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}
.dtd-chip .dtd-count{min-width:20px;height:20px;padding:0 7px;border-radius:10px;line-height:20px}
.dtd-totals{flex:none;margin-left:auto;font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dtd-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dtd-check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary)}
.dtd-preview{margin:0;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px;white-space:pre-wrap}
.dtd-reportTabs{display:flex;gap:6px;margin-bottom:10px}
.dtd-reportTab{height:32px;padding:0 14px;border-radius:16px;border:.5px solid var(--dsw-alias-border-l3);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.dtd-reportTab[aria-selected="true"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}
.dtd-reportPeriods{margin-bottom:10px}
.dtd-reportPreview{margin:0;max-height:420px;overflow:auto;padding:14px 16px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:20px;white-space:pre-wrap}
.dtd-nlp{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dtd-nlpToggle{display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:16px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.dtd-nlpToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-nlpRow{display:flex;align-items:center;gap:8px;flex:1;min-width:280px}
.dtd-nlpInput{flex:1;min-width:0}
.dtd-nlpTextarea{min-height:160px}
.dtd-nlpBanner{padding:8px 12px;border-radius:10px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:12.5px;line-height:19px}
.dtd-field-badge{display:inline-flex;align-items:center;height:16px;margin-left:6px;padding:0 6px;border-radius:8px;font-size:10.5px;line-height:16px;font-weight:400}
.dtd-listMeta{display:flex;align-items:center;gap:10px;padding:0 0 8px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dtd-scope{display:flex;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;overflow:hidden;flex:none}
.dtd-scopeBtn{height:28px;padding:0 10px;border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.dtd-scopeBtn[aria-pressed="true"]{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.dtd-searchResult{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:2px clamp(20px,4vw,48px) 0;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dtd-searchLimit{color:var(--dsw-alias-state-warn-primary)}
.dtd-linkBtn{border:0;background:0 0;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:12px;cursor:pointer;padding:0;text-decoration:underline}
.dtd-emptyActions{display:flex;gap:8px;margin-top:12px}
.dtd-nlpBanner.is-warning{background:var(--dsw-alias-state-warn-tertiary, #fff4e5);color:var(--dsw-alias-label-primary);border:.5px solid var(--dsw-alias-state-warn-primary)}
.dtd-degradedReason{margin-top:4px;font-size:12.5px;color:var(--dsw-alias-state-warn-primary)}
.dtd-degradedActions{display:flex;gap:8px;margin-top:8px}
.dtd-badge.stage{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border:.5px solid var(--dsw-alias-border-l3)}
.dtd-field-badge.is-default{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border:.5px solid var(--dsw-alias-border-l3)}
.dtd-field-badge.is-missing{background:var(--dsw-alias-state-warn-tertiary, #fff4e5);color:var(--dsw-alias-state-warn-primary)}
.dtd-field-error{margin-top:4px;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary)}
.dtd-input[aria-invalid="true"]{border-color:var(--dsw-alias-state-error-primary)}
.dtd-error{border:.5px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:8px 10px;color:var(--dsw-alias-state-error-primary);font-size:12.5px;line-height:19px;background:var(--dsw-alias-bg-layer-1)}
.dtd-cardA{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}

/* ── menu ───────────────────────────────────────────────── */
.dtd-menu{position:fixed;z-index:70;min-width:168px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-3);border:.5px solid var(--dsw-alias-border-l3)}
.dtd-menu button{display:flex;width:100%;align-items:center;gap:8px;height:32px;padding:0 10px;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.dtd-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-menu button.danger{color:var(--dsw-alias-state-error-primary)}
.dtd-menu hr{margin:4px 2px;border:0;border-top:.5px solid var(--dsw-alias-border-l4)}

/* ── toast ──────────────────────────────────────────────── */
.dtd-toast{position:fixed;right:24px;bottom:24px;z-index:80;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-3);font-size:13px}
.dtd-toast button{border:0;background:0 0;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer}

/* ── overlay ────────────────────────────────────────────── */
.dtd-overlay{position:fixed;right:24px;bottom:24px;z-index:55;display:flex;flex-direction:column;gap:10px;width:min(360px,calc(100vw - 48px));max-height:calc(100vh - 96px);pointer-events:none}
.dtd-overlayStack{display:flex;flex-direction:column;gap:10px;overflow:auto;pointer-events:auto;--dsh-scrollbar-width:8px}
.dtd-reminder{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:14px;background:var(--dsw-alias-bg-layer-3);box-shadow:0 10px 28px var(--dsw-alias-bg-mask-3);border:.5px solid var(--dsw-alias-border-l3);pointer-events:auto}
.dtd-reminderHead{display:flex;align-items:center;gap:8px}
.dtd-reminderHead .glyph{color:var(--dsw-alias-state-warn-primary);flex:none}
.dtd-reminderTitle{flex:1;min-width:0;font-weight:500;font-size:13.5px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dtd-reminderTime{flex:none;color:var(--dsw-alias-label-caption);font-size:11px}
.dtd-reminderText{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:19px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:5.7em;overflow:hidden}
.dtd-reminderActions{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.dtd-reminderActions .grow{flex:1}
.dtd-overlayMore{pointer-events:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12.5px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3)}
.dtd-overlayMore:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtd-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

@media (width<=720px){
  .dtd-head{flex-direction:column;align-items:stretch;padding-top:20px}
  .dtd-actions{justify-content:flex-end}
  .dtd-tabs{gap:14px}
  .dtd-filters{gap:8px}
  .dtd-totals{flex-basis:100%;margin-left:0}
  .dtd-rowRight{display:none}
  .dtd-rowActions{display:flex;position:static;transform:none;background:0 0;box-shadow:none;padding:0}
  .dtd-rules{font-size:11.5px}
}
`
