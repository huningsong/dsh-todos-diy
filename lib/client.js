window.__ModuleLoader__.load({
  id: 'dsh-todos-diy',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    ;(function (module, exports, require) {
      "use strict";
      var __create = Object.create;
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames = Object.getOwnPropertyNames;
      var __getProtoOf = Object.getPrototypeOf;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __export = (target, all) => {
        for (var name in all)
          __defProp(target, name, { get: all[name], enumerable: true });
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
        // If the importer is in node compatibility mode or this is not an ESM
        // file that has been converted to a CommonJS file using a Babel-
        // compatible transform (i.e. "__esModule" has not been set), then set
        // "default" to the CommonJS "module.exports" for node compatibility.
        isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
        mod
      ));
      var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

      // src/client/index.ts
      var index_exports = {};
      __export(index_exports, {
        apply: () => apply,
        default: () => index_default
      });
      module.exports = __toCommonJS(index_exports);
      var React10 = __toESM(require("react"), 1);

      // src/client/styles.ts
      var CSS = `
      .dtd-page{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;overflow:hidden}

      /* \u2500\u2500 header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

      /* \u2500\u2500 tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-tabs{display:flex;align-items:center;gap:24px;padding:0 clamp(20px,4vw,48px);margin-top:18px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
      .dtd-tab{position:relative;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0;border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;cursor:pointer}
      .dtd-tab:hover{color:var(--dsw-alias-label-secondary)}
      .dtd-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);font-weight:500}
      .dtd-tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-.5px;height:2px;border-radius:2px;background:var(--dsw-alias-label-primary)}
      .dtd-count{min-width:18px;height:18px;padding:0 6px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center}

      /* \u2500\u2500 rule strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-rules{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:10px clamp(20px,4vw,48px);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;border-bottom:.5px solid var(--dsw-alias-border-l4)}
      .dtd-rules b{font-weight:500;color:var(--dsw-alias-label-secondary)}
      .dtd-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:1px}
      .dtd-dot.high{background:var(--dsw-alias-state-error-primary)}
      .dtd-dot.mid{background:var(--dsw-alias-state-warn-primary)}
      .dtd-dot.low{background:var(--dsw-alias-state-business-primary)}
      .dtd-dot.none{background:var(--dsw-alias-label-caption)}
      .dtd-rules .refresh{margin-left:auto}

      /* \u2500\u2500 toolbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-toolbar{display:flex;align-items:center;gap:10px;padding:14px clamp(20px,4vw,48px) 6px}
      .dtd-search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;color:var(--dsw-alias-label-tertiary)}
      .dtd-search:focus-within{border-color:var(--dsw-alias-state-business-primary)}
      .dtd-search input{flex:1;min-width:0;border:0;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
      .dtd-search input::placeholder{color:var(--dsw-alias-label-caption)}

      /* \u2500\u2500 body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-body{flex:1;min-height:0;overflow:auto;padding:8px clamp(20px,4vw,48px) 48px}
      .dtd-group{margin-top:14px}
      .dtd-groupHead{display:flex;align-items:baseline;gap:8px;padding:0 4px 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .dtd-groupHead b{font-weight:500;color:var(--dsw-alias-label-secondary)}
      .dtd-groupHead .n{color:var(--dsw-alias-label-caption)}
      .dtd-groupHead .hint{margin-left:auto;color:var(--dsw-alias-label-caption)}
      .dtd-rows{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}

      /* \u2500\u2500 row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-row{position:relative;display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer}
      .dtd-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dtd-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
      .dtd-row.pinned{background:var(--dsw-alias-state-warn-tertiary)}
      .dtd-row.pinned:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}
      .dtd-check{flex:none;width:18px;height:18px;margin-top:4px;border:1.5px solid var(--dsw-alias-border-l3);border-radius:50%;background:0 0;cursor:pointer;padding:0}
      .dtd-check:hover{border-color:var(--dsw-alias-state-business-primary)}
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

      /* \u2500\u2500 badges \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:6px;font-size:11px;line-height:18px;font-weight:400;white-space:nowrap}
      .dtd-badge.high{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}
      .dtd-badge.mid{background:var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-state-warn-label)}
      .dtd-badge.low{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
      .dtd-badge.none{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
      .dtd-badge.paused{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
      .dtd-badge.overdue{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}
      .dtd-badge.pinned{background:var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-state-warn-label)}
      .dtd-badge.kind{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}

      /* \u2500\u2500 empty / loading / error \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

      /* \u2500\u2500 modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
      .dtd-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:13px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px}
      .dtd-chip button{border:0;background:0 0;color:inherit;cursor:pointer;padding:0;font:inherit;line-height:1}
      .dtd-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      .dtd-check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary)}
      .dtd-preview{margin:0;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px;white-space:pre-wrap}
      .dtd-error{border:.5px solid var(--dsw-alias-state-error-primary);border-radius:10px;padding:8px 10px;color:var(--dsw-alias-state-error-primary);font-size:12.5px;line-height:19px;background:var(--dsw-alias-bg-layer-1)}
      .dtd-cardA{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}

      /* \u2500\u2500 menu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-menu{position:fixed;z-index:70;min-width:168px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-3);border:.5px solid var(--dsw-alias-border-l3)}
      .dtd-menu button{display:flex;width:100%;align-items:center;gap:8px;height:32px;padding:0 10px;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
      .dtd-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dtd-menu button.danger{color:var(--dsw-alias-state-error-primary)}
      .dtd-menu hr{margin:4px 2px;border:0;border-top:.5px solid var(--dsw-alias-border-l4)}

      /* \u2500\u2500 toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dtd-toast{position:fixed;right:24px;bottom:24px;z-index:80;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-3);font-size:13px}
      .dtd-toast button{border:0;background:0 0;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer}

      /* \u2500\u2500 overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
        .dtd-rowRight{display:none}
        .dtd-rowActions{display:flex;position:static;transform:none;background:0 0;box-shadow:none;padding:0}
        .dtd-rules{font-size:11.5px}
      }
      `;

      // src/client/dictionary-zh.ts
      var zh = {
        "entry.label": "\u5DE5\u4F5C\u5F85\u529E",
        "entry.short": "\u5F85\u529E",
        "panel.title": "\u5DE5\u4F5C\u5F85\u529E",
        "panel.subtitle": "\u6309\u671F\u63D0\u9192\uFF0C\u4E0D\u6F0F\u4E8B\u3001\u4E0D\u91CD\u590D",
        "panel.new": "\u65B0\u5EFA\u4EFB\u52A1",
        "panel.search": "\u641C\u7D22\u6807\u9898\u4E0E\u8BF4\u660E",
        "panel.refresh": "\u5237\u65B0",
        "panel.settings": "\u8BBE\u7F6E",
        "tab.todo": "\u5F85\u529E",
        "tab.done": "\u5DF2\u5B8C\u6210",
        "tab.overdue": "\u8D85\u671F",
        "rule.hint": "\u4F18\u5148\u7EA7\u89C4\u5219\u6761",
        "rule.high": "\u9AD8 = \u4ECA\u5929/\u5DF2\u8D85\u671F",
        "rule.mid": "\u4E2D = 3 \u5929\u5185",
        "rule.low": "\u4F4E = 7 \u5929\u5185",
        "rule.none": "\u65E0 = 7 \u5929\u4EE5\u4E0A\u6216\u65E0\u622A\u6B62",
        "rule.refresh": "\u6BCF\u65E5 00:05 \u81EA\u52A8\u91CD\u7B97",
        "group.pinned": "\u7F6E\u9876",
        "group.high": "\u9AD8\u4F18\u5148\u7EA7",
        "group.mid": "\u4E2D\u4F18\u5148\u7EA7",
        "group.low": "\u4F4E\u4F18\u5148\u7EA7",
        "group.none": "\u65E0\u4F18\u5148\u7EA7",
        "group.paused": "\u5DF2\u6682\u505C",
        "group.pinnedHint": "\u5B8C\u6210\u540E\u81EA\u52A8\u53D6\u6D88\u7F6E\u9876",
        "priority.high": "\u9AD8",
        "priority.mid": "\u4E2D",
        "priority.low": "\u4F4E",
        "priority.none": "\u65E0",
        "priority.paused": "\u5DF2\u6682\u505C",
        "status.active": "\u542F\u7528\u4E2D",
        "status.paused": "\u5DF2\u6682\u505C",
        "status.done": "\u5DF2\u5B8C\u6210",
        "status.archived": "\u56DE\u6536\u7AD9",
        "kind.recurring": "\u5FAA\u73AF",
        "kind.once": "\u5355\u6B21",
        "task.today": "\u4ECA\u5929\u5230\u671F",
        "task.tomorrow": "\u660E\u5929\u5230\u671F",
        "task.daysLater": "{n} \u5929\u540E",
        "task.overdue": "\u8D85\u671F {n} \u5929",
        "task.dueOn": "\u622A\u6B62 {date}",
        "task.noDue": "\u65E0\u622A\u6B62",
        "task.nextAt": "\u4E0B\u6B21 {time}",
        "task.noNext": "\u65E0\u4E0B\u6B21\u89E6\u53D1",
        "task.pin": "\u7F6E\u9876",
        "task.unpin": "\u53D6\u6D88\u7F6E\u9876",
        "task.pause": "\u6682\u505C",
        "task.resume": "\u6062\u590D",
        "task.more": "\u66F4\u591A",
        "task.complete": "\u5B8C\u6210",
        "task.edit": "\u7F16\u8F91",
        "task.copy": "\u590D\u5236",
        "task.delete": "\u5220\u9664",
        "task.remindNow": "\u7ACB\u5373\u63D0\u9192\u4E00\u6B21",
        "task.history": "\u67E5\u770B\u5386\u53F2",
        "empty.todo": "\u8FD8\u6CA1\u6709\u5F85\u529E\u4EFB\u52A1",
        "empty.done": "\u8FD8\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1",
        "empty.overdue": "\u6CA1\u6709\u8D85\u671F\u4EFB\u52A1",
        "empty.hint": "\u65B0\u5EFA\u4E00\u6761\u5FAA\u73AF\u89C4\u5219\u6216\u5355\u6B21\u4EFB\u52A1\uFF0C\u5230\u70B9\u4F1A\u5728\u53F3\u4E0B\u89D2\u63D0\u9192\u4F60\u3002",
        "empty.firstTitle": "\u4ECE\u8FD9\u4E09\u5F20\u5361\u7247\u5F00\u59CB",
        "empty.example1": "\u6BCF\u4E2A\u5DE5\u4F5C\u65E5 9:00 \u67E5\u770B\u4ECA\u65E5\u5F85\u529E",
        "empty.example2": "\u6BCF\u6708\u6700\u540E\u4E00\u5929 17:00 \u63D0\u4EA4\u6708\u5EA6\u6750\u6599",
        "empty.example3": "\u5355\u6B21\uFF1A\u660E\u5929 14:00\u201318:00 \u5B63\u5EA6\u8BC4\u5BA1",
        "empty.useExample": "\u4E00\u952E\u521B\u5EFA",
        "state.loading": "\u6B63\u5728\u52A0\u8F7D\u2026",
        "state.errorTitle": "\u6682\u65F6\u8BFB\u4E0D\u5230\u4EFB\u52A1\u6570\u636E",
        "state.errorHint": "\u5BBF\u4E3B\u8DEF\u7531\u4E0D\u53EF\u7528\u6216\u7F51\u7EDC\u4E2D\u65AD\u3002",
        "state.retry": "\u91CD\u8BD5",
        "state.saving": "\u4FDD\u5B58\u4E2D\u2026",
        "form.title.new": "\u65B0\u5EFA\u4EFB\u52A1",
        "form.title.edit": "\u7F16\u8F91\u4EFB\u52A1",
        "form.kind": "\u4EFB\u52A1\u7C7B\u578B",
        "form.kind.recurring": "\u5FAA\u73AF\u4EFB\u52A1",
        "form.kind.recurringHint": "\u5DE5\u4F5C\u65E5 / \u6BCF\u5468 / \u6BCF\u6708 / \u81EA\u5B9A\u4E49 cron",
        "form.kind.once": "\u5355\u6B21\u4EFB\u52A1",
        "form.kind.onceHint": "\u6307\u5B9A\u5F00\u59CB\u4E0E\u7ED3\u675F\u65F6\u95F4\uFF0C\u4E24\u7AEF\u90FD\u63D0\u9192",
        "form.name": "\u4EFB\u52A1\u540D\u79F0",
        "form.namePlaceholder": "\u4F8B\u5982\uFF1A\u67E5\u770B\u4ECA\u65E5\u5F85\u529E",
        "form.nameHint": "1\u2013200 \u5B57\u7B26\uFF1B\u63D0\u9192\u5361\u7247\u4E0E\u5217\u8868\u90FD\u4F7F\u7528\u8BE5\u540D\u79F0",
        "form.description": "\u8BF4\u660E",
        "form.descriptionPlaceholder": "\u8FD9\u6761\u5F85\u529E\u8981\u505A\u4EC0\u4E48\uFF1F",
        "form.dueDate": "\u622A\u6B62\u65E5\u671F",
        "form.dueDateHint": "\u53EA\u7528\u4E8E\u5206\u7EC4\u3001\u8D85\u671F\u4E0E\u4F18\u5148\u7EA7\uFF0C\u4E0D\u4EA7\u751F\u63D0\u9192",
        "form.rule": "\u91CD\u590D\u89C4\u5219",
        "form.preset.workdays": "\u6BCF\u4E2A\u5DE5\u4F5C\u65E5",
        "form.preset.weekly": "\u6BCF\u5468",
        "form.preset.monthly": "\u6BCF\u6708",
        "form.preset.custom": "\u81EA\u5B9A\u4E49 cron",
        "form.time": "\u65F6\u95F4",
        "form.timeZone": "\u65F6\u533A",
        "form.weekdays": "\u661F\u671F",
        "form.monthDays": "\u6BCF\u6708\u65E5\u671F",
        "form.cron": "cron \u8868\u8FBE\u5F0F",
        "form.cronHint": "5 \u5B57\u6BB5 Vixie\uFF1A\u5206 \u65F6 \u65E5 \u6708 \u5468\u3002\u62D2\u7EDD L/W/#\u3001\u82F1\u6587\u540D\u3001@ \u5B8F",
        "form.holidayCalendar": "\u5DE5\u4F5C\u65E5\u53E3\u5F84",
        "form.holidayCalendar.CN": "\u8DDF\u968F\u4E2D\u56FD\u6CD5\u5B9A\u8282\u5047\u65E5\u4E0E\u8C03\u4F11",
        "form.holidayCalendar.none": "\u56FA\u5B9A\u5468\u4E00\u81F3\u5468\u4E94",
        "form.holidayCalendarHint": "\u5185\u7F6E 2024\u20132027 \u8282\u5047\u65E5\u8868\uFF1B\u6CD5\u5B9A\u8282\u5047\u65E5\u8DF3\u8FC7\uFF0C\u8C03\u4F11\u8865\u73ED\u7684\u5468\u672B\u6B63\u5E38\u63D0\u9192",
        "form.monthlyOverflow": "\u6708\u672B\u7B56\u7565",
        "form.monthlyOverflow.lastDay": "\u987A\u5EF6\u5230\u5F53\u6708\u6700\u540E\u4E00\u5929",
        "form.monthlyOverflow.skip": "\u8DF3\u8FC7\u8BE5\u6708",
        "form.skipDates": "\u8DF3\u8FC7\u65E5\u671F",
        "form.extraWorkdays": "\u8865\u73ED\u65E5\u671F",
        "form.exceptionHint": "\u6309\u4EFB\u52A1\u65F6\u533A\u7684\u672C\u5730\u65E5\u671F\uFF1B\u7528\u6237\u624B\u5DE5\u8986\u76D6\u4F18\u5148\u4E8E\u5185\u7F6E\u8282\u5047\u65E5\u8868",
        "form.addDate": "\u6DFB\u52A0\u65E5\u671F",
        "form.startAt": "\u5F00\u59CB\u65F6\u95F4",
        "form.endAt": "\u7ED3\u675F\u65F6\u95F4",
        "form.onceHint": "\u5F00\u59CB\u4E0E\u7ED3\u675F\u5404\u63D0\u9192\u4E00\u6B21\uFF08D-03\uFF09\uFF1BendAt \u5FC5\u987B\u665A\u4E8E startAt",
        "form.notify": "\u63D0\u9192\u65B9\u5F0F",
        "form.notify.overlay": "\u6D6E\u5C42\uFF08\u5FC5\u6709\uFF09",
        "form.notify.system": "\u7CFB\u7EDF\u901A\u77E5\uFF08\u9875\u9762\u4E0D\u53EF\u89C1\u65F6\uFF09",
        "form.advance": "\u63D0\u524D\u91CF\uFF08\u5206\u949F\uFF09",
        "form.advanceHint": "0\u20131440\uFF1B\u63D0\u524D\u63D0\u9192\u53D6\u4EE3\u6B63\u70B9\u63D0\u9192\uFF0C\u4E0D\u4F1A\u63D0\u9192\u4E24\u6B21",
        "form.sound": "\u63D0\u793A\u97F3",
        "form.template": "\u63D0\u9192\u6587\u6848",
        "form.templateHint": "\u53EF\u7528\u53D8\u91CF\uFF1A{title} {time} {note} {phase}",
        "form.preview": "\u672A\u6765 5 \u6B21\u89E6\u53D1",
        "form.previewEmpty": "\u8BE5\u89C4\u5219\u6682\u65E0\u672A\u6765\u89E6\u53D1",
        "form.save": "\u4FDD\u5B58\u4EFB\u52A1",
        "form.cancel": "\u53D6\u6D88",
        "form.saved": "\u5DF2\u4FDD\u5B58",
        "form.invalidCron": "\u8868\u8FBE\u5F0F\u65E0\u6548\uFF1A{message}",
        "form.required": "\u5FC5\u586B",
        "form.endAfterStart": "\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4",
        "form.weekday.1": "\u4E00",
        "form.weekday.2": "\u4E8C",
        "form.weekday.3": "\u4E09",
        "form.weekday.4": "\u56DB",
        "form.weekday.5": "\u4E94",
        "form.weekday.6": "\u516D",
        "form.weekday.7": "\u65E5",
        "confirm.deleteTitle": "\u5220\u9664\u8FD9\u6761\u4EFB\u52A1\uFF1F",
        "confirm.deleteBody": "\u5220\u9664\u540E\u8FDB\u5165\u56DE\u6536\u7AD9\uFF0C30 \u5929\u5185\u53EF\u6062\u590D\u3002",
        "confirm.purgeTitle": "\u5F7B\u5E95\u5220\u9664\uFF1F",
        "confirm.purgeBody": "\u5F7B\u5E95\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\uFF0C\u8BF7\u8F93\u5165\u786E\u8BA4\u3002",
        "confirm.ok": "\u786E\u8BA4\u5220\u9664",
        "confirm.cancel": "\u53D6\u6D88",
        "toast.pinned": "\u5DF2\u7F6E\u9876",
        "toast.unpinned": "\u5DF2\u53D6\u6D88\u7F6E\u9876",
        "toast.paused": "\u5DF2\u6682\u505C",
        "toast.resumed": "\u5DF2\u6062\u590D",
        "toast.completed": "\u5DF2\u5B8C\u6210 \xB7 \u64A4\u9500",
        "toast.deleted": "\u5DF2\u5220\u9664 \xB7 \u64A4\u9500",
        "toast.undo": "\u64A4\u9500",
        "toast.error": "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
        "overlay.title": "\u5F85\u529E\u63D0\u9192",
        "overlay.more": "\u8FD8\u6709 {n} \u6761",
        "overlay.expand": "\u5C55\u5F00",
        "overlay.collapse": "\u6536\u8D77",
        "overlay.summary": "{n} \u6761\u5F85\u529E\u63D0\u9192",
        "overlay.complete": "\u5B8C\u6210\u672C\u6B21",
        "overlay.snooze": "\u7A0D\u540E\u63D0\u9192",
        "overlay.snooze5": "5 \u5206\u949F",
        "overlay.snooze15": "15 \u5206\u949F",
        "overlay.snooze60": "1 \u5C0F\u65F6",
        "overlay.dismiss": "\u5173\u95ED",
        "overlay.at": "\u89E6\u53D1\u65F6\u95F4",
        "overlay.phase.start": "\u4EFB\u52A1\u5F00\u59CB",
        "overlay.phase.end": "\u4EFB\u52A1\u7ED3\u675F",
        "overlay.phase.advance": "\u63D0\u524D\u63D0\u9192",
        "overlay.a11y": "\u5F85\u529E\u63D0\u9192\uFF08{n} \u6761\uFF09",
        "archive.current": "\u672C\u5B63\u5EA6",
        "archive.history": "\u5386\u53F2\u5F52\u6863",
        "archive.all": "\u5168\u90E8\u5B63\u5EA6",
        "archive.empty": "\u8FD9\u4E2A\u5B63\u5EA6\u6CA1\u6709\u5DF2\u5B8C\u6210\u4EFB\u52A1",
        "archive.loading": "\u6B63\u5728\u8BFB\u53D6\u5F52\u6863\u2026",
        "archive.error": "\u5F52\u6863\u8BFB\u53D6\u5931\u8D25",
        "archive.restore": "\u6062\u590D\u4E3A\u5F85\u529E",
        "archive.restored": "\u5DF2\u6062\u590D\u5230\u5F85\u529E",
        "archive.quarter": "{quarter}",
        "archive.noQuarters": "\u6682\u65E0\u5386\u53F2\u5B63\u5EA6",
        "settings.title": "\u8BBE\u7F6E",
        "settings.timeZone": "\u9ED8\u8BA4\u65F6\u533A",
        "settings.timeZoneHint": "\u53EA\u5F71\u54CD\u65B0\u5EFA\u4EFB\u52A1\uFF1B\u5DF2\u6709\u4EFB\u52A1\u4FDD\u6301\u81EA\u5DF1\u7684\u65F6\u533A",
        "settings.dnd": "\u514D\u6253\u6270",
        "settings.dndEnabled": "\u5F00\u542F\u514D\u6253\u6270",
        "settings.dndStart": "\u5F00\u59CB",
        "settings.dndEnd": "\u7ED3\u675F",
        "settings.dndWeekdays": "\u4EC5\u5DE5\u4F5C\u65E5\u751F\u6548",
        "settings.dndHint": "\u65F6\u6BB5\u5185\u4E0D\u5F39\u6D6E\u5C42\u4E0E\u901A\u77E5\uFF1B\u8D85\u8FC7 12 \u5C0F\u65F6\u6216\u8DE8\u8FC7\u6574\u4E2A\u767D\u5929\u5219\u4E0D\u518D\u8865\u5F39",
        "settings.channels": "\u9ED8\u8BA4\u63D0\u9192\u65B9\u5F0F",
        "settings.grace": "\u8865\u53D1\u5BBD\u9650\uFF08\u5206\u949F\uFF09",
        "settings.graceHint": "\u5230\u70B9\u540E\u8BE5\u7A97\u53E3\u5185\u4ECD\u53EF\u8865\u63D0\u9192\u4E00\u6B21\uFF1B\u8D85\u8FC7\u5219\u6807\u8BB0\u4E3A\u9519\u8FC7",
        "settings.export": "\u5BFC\u51FA\u6570\u636E",
        "settings.import": "\u5BFC\u5165\u6570\u636E",
        "settings.importReplace": "\u66FF\u6362\u5168\u90E8",
        "settings.importMerge": "\u5408\u5E76",
        "settings.backup": "\u5BFC\u5165\u524D\u4F1A\u81EA\u52A8\u5907\u4EFD\u5F53\u524D\u6570\u636E",
        "settings.saved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
        "error.invalid_argument": "\u53C2\u6570\u4E0D\u5408\u6CD5",
        "error.invalid_cron": "cron \u8868\u8FBE\u5F0F\u65E0\u6548",
        "error.invalid_timezone": "\u65F6\u533A\u65E0\u6CD5\u8BC6\u522B",
        "error.not_found": "\u5BF9\u8C61\u4E0D\u5B58\u5728",
        "error.invalid_state": "\u5F53\u524D\u72B6\u6001\u4E0D\u5141\u8BB8\u8BE5\u64CD\u4F5C",
        "error.no_occurrence": "\u5F53\u524D\u6CA1\u6709\u53EF\u5B8C\u6210\u7684\u63D0\u9192",
        "error.conflict": "\u5DF2\u88AB\u5176\u5B83\u7A97\u53E3\u4FEE\u6539\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5",
        "error.read_only": "\u53E6\u4E00\u4E2A\u5B9E\u4F8B\u6B63\u5728\u4F7F\u7528\u6570\u636E",
        "error.schema_mismatch": "\u5BFC\u5165\u6587\u4EF6\u7248\u672C\u4E0D\u517C\u5BB9",
        "error.storage_error": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u78C1\u76D8",
        "error.forbidden": "\u6CA1\u6709\u6743\u9650",
        "error.internal_error": "\u5185\u90E8\u9519\u8BEF",
        "error.unauthorized": "\u9700\u8981\u5148\u767B\u5F55 DSH",
        "error.payload_too_large": "\u8BF7\u6C42\u5185\u5BB9\u8FC7\u5927"
      };

      // src/client/dictionary-en.ts
      var en = {
        "entry.label": "Work To-Dos",
        "entry.short": "To-dos",
        "panel.title": "Work To-Dos",
        "panel.subtitle": "Timely reminders \u2014 nothing missed, nothing repeated",
        "panel.new": "New task",
        "panel.search": "Search title and notes",
        "panel.refresh": "Refresh",
        "panel.settings": "Settings",
        "tab.todo": "To do",
        "tab.done": "Done",
        "tab.overdue": "Overdue",
        "rule.hint": "Priority rules",
        "rule.high": "High = today/overdue",
        "rule.mid": "Mid = within 3 days",
        "rule.low": "Low = within 7 days",
        "rule.none": "None = over 7 days or no deadline",
        "rule.refresh": "Recalculated daily at 00:05",
        "group.pinned": "Pinned",
        "group.high": "High priority",
        "group.mid": "Mid priority",
        "group.low": "Low priority",
        "group.none": "No priority",
        "group.paused": "Paused",
        "group.pinnedHint": "Unpinned automatically when completed",
        "priority.high": "High",
        "priority.mid": "Mid",
        "priority.low": "Low",
        "priority.none": "None",
        "priority.paused": "Paused",
        "status.active": "Active",
        "status.paused": "Paused",
        "status.done": "Done",
        "status.archived": "Trashed",
        "kind.recurring": "Recurring",
        "kind.once": "One-off",
        "task.today": "Due today",
        "task.tomorrow": "Due tomorrow",
        "task.daysLater": "In {n} days",
        "task.overdue": "{n} days overdue",
        "task.dueOn": "Due {date}",
        "task.noDue": "No deadline",
        "task.nextAt": "Next {time}",
        "task.noNext": "No next run",
        "task.pin": "Pin",
        "task.unpin": "Unpin",
        "task.pause": "Pause",
        "task.resume": "Resume",
        "task.more": "More",
        "task.complete": "Complete",
        "task.edit": "Edit",
        "task.copy": "Duplicate",
        "task.delete": "Delete",
        "task.remindNow": "Remind me once now",
        "task.history": "View history",
        "empty.todo": "No tasks yet",
        "empty.done": "Nothing completed yet",
        "empty.overdue": "Nothing overdue",
        "empty.hint": "Create a recurring rule or a one-off task; reminders appear in the corner.",
        "empty.firstTitle": "Start with one of these",
        "empty.example1": "Every workday at 9:00, review today\u2019s to-dos",
        "empty.example2": "Last day of each month at 17:00, submit monthly materials",
        "empty.example3": "One-off: tomorrow 14:00\u201318:00 quarterly review",
        "empty.useExample": "Create this",
        "state.loading": "Loading\u2026",
        "state.errorTitle": "Task data is unavailable",
        "state.errorHint": "The host route is unavailable or the network dropped.",
        "state.retry": "Retry",
        "state.saving": "Saving\u2026",
        "form.title.new": "New task",
        "form.title.edit": "Edit task",
        "form.kind": "Task type",
        "form.kind.recurring": "Recurring",
        "form.kind.recurringHint": "Workdays / weekly / monthly / custom cron",
        "form.kind.once": "One-off",
        "form.kind.onceHint": "Start and end times, both remind",
        "form.name": "Task name",
        "form.namePlaceholder": "e.g. Review today\u2019s to-dos",
        "form.nameHint": "1\u2013200 characters; used on the card and in the list",
        "form.description": "Notes",
        "form.descriptionPlaceholder": "What needs doing?",
        "form.dueDate": "Deadline",
        "form.dueDateHint": "Used only for grouping, overdue and priority \u2014 never for reminders",
        "form.rule": "Repeat rule",
        "form.preset.workdays": "Every workday",
        "form.preset.weekly": "Weekly",
        "form.preset.monthly": "Monthly",
        "form.preset.custom": "Custom cron",
        "form.time": "Time",
        "form.timeZone": "Time zone",
        "form.weekdays": "Weekdays",
        "form.monthDays": "Days of month",
        "form.cron": "cron expression",
        "form.cronHint": "5-field Vixie: minute hour day month weekday. L/W/#, names and @ macros rejected",
        "form.holidayCalendar": "Workday basis",
        "form.holidayCalendar.CN": "Follow Chinese statutory holidays",
        "form.holidayCalendar.none": "Monday to Friday only",
        "form.holidayCalendarHint": "Built-in 2024\u20132027 table; holidays skipped, make-up weekends fire",
        "form.monthlyOverflow": "Month-end policy",
        "form.monthlyOverflow.lastDay": "Move to the last day of the month",
        "form.monthlyOverflow.skip": "Skip that month",
        "form.skipDates": "Skip dates",
        "form.extraWorkdays": "Make-up workdays",
        "form.exceptionHint": "Local dates in the task zone; manual entries override the holiday table",
        "form.addDate": "Add date",
        "form.startAt": "Start",
        "form.endAt": "End",
        "form.onceHint": "Both nodes remind once (D-03); endAt must be later than startAt",
        "form.notify": "Channels",
        "form.notify.overlay": "Overlay (always on)",
        "form.notify.system": "System notification (only when the page is hidden)",
        "form.advance": "Advance (minutes)",
        "form.advanceHint": "0\u20131440; the advance reminder replaces the on-time one",
        "form.sound": "Sound",
        "form.template": "Reminder text",
        "form.templateHint": "Variables: {title} {time} {note} {phase}",
        "form.preview": "Next 5 runs",
        "form.previewEmpty": "This rule has no upcoming run",
        "form.save": "Save task",
        "form.cancel": "Cancel",
        "form.saved": "Saved",
        "form.invalidCron": "Invalid expression: {message}",
        "form.required": "Required",
        "form.endAfterStart": "End must be later than start",
        "form.weekday.1": "Mon",
        "form.weekday.2": "Tue",
        "form.weekday.3": "Wed",
        "form.weekday.4": "Thu",
        "form.weekday.5": "Fri",
        "form.weekday.6": "Sat",
        "form.weekday.7": "Sun",
        "confirm.deleteTitle": "Delete this task?",
        "confirm.deleteBody": "It moves to the bin and can be restored within 30 days.",
        "confirm.purgeTitle": "Delete permanently?",
        "confirm.purgeBody": "This cannot be undone.",
        "confirm.ok": "Delete",
        "confirm.cancel": "Cancel",
        "toast.pinned": "Pinned",
        "toast.unpinned": "Unpinned",
        "toast.paused": "Paused",
        "toast.resumed": "Resumed",
        "toast.completed": "Completed \xB7 Undo",
        "toast.deleted": "Deleted \xB7 Undo",
        "toast.undo": "Undo",
        "toast.error": "Failed: {message}",
        "overlay.title": "Reminders",
        "overlay.more": "{n} more",
        "overlay.expand": "Show",
        "overlay.collapse": "Hide",
        "overlay.summary": "{n} reminders",
        "overlay.complete": "Complete",
        "overlay.snooze": "Snooze",
        "overlay.snooze5": "5 min",
        "overlay.snooze15": "15 min",
        "overlay.snooze60": "1 hour",
        "overlay.dismiss": "Dismiss",
        "overlay.at": "Fires at",
        "overlay.phase.start": "Task started",
        "overlay.phase.end": "Task ended",
        "overlay.phase.advance": "Advance reminder",
        "overlay.a11y": "Reminders ({n})",
        "archive.current": "This quarter",
        "archive.history": "Archive",
        "archive.all": "All quarters",
        "archive.empty": "Nothing completed in this quarter",
        "archive.loading": "Loading archive\u2026",
        "archive.error": "Could not read the archive",
        "archive.restore": "Restore to to-dos",
        "archive.restored": "Restored to to-dos",
        "archive.quarter": "{quarter}",
        "archive.noQuarters": "No archived quarters yet",
        "settings.title": "Settings",
        "settings.timeZone": "Default time zone",
        "settings.timeZoneHint": "Affects new tasks only; existing tasks keep their own zone",
        "settings.dnd": "Do not disturb",
        "settings.dndEnabled": "Enable DND",
        "settings.dndStart": "Start",
        "settings.dndEnd": "End",
        "settings.dndWeekdays": "Weekdays only",
        "settings.dndHint": "No overlay or notification in the window; over 12 hours or a whole daytime is dropped",
        "settings.channels": "Default channels",
        "settings.grace": "Grace window (minutes)",
        "settings.graceHint": "Late occurrences still fire once inside this window; later ones are marked missed",
        "settings.export": "Export data",
        "settings.import": "Import data",
        "settings.importReplace": "Replace all",
        "settings.importMerge": "Merge",
        "settings.backup": "Current data is backed up before an import",
        "settings.saved": "Settings saved",
        "error.invalid_argument": "Invalid argument",
        "error.invalid_cron": "Invalid cron expression",
        "error.invalid_timezone": "Unknown time zone",
        "error.not_found": "Not found",
        "error.invalid_state": "This action is not allowed in the current state",
        "error.no_occurrence": "Nothing to complete right now",
        "error.conflict": "Changed in another window \u2014 refresh and retry",
        "error.read_only": "Another instance is using the data",
        "error.schema_mismatch": "Incompatible import file",
        "error.storage_error": "Save failed \u2014 check the disk",
        "error.forbidden": "Not permitted",
        "error.internal_error": "Internal error",
        "error.unauthorized": "DSH login required",
        "error.payload_too_large": "Request too large"
      };

      // src/client/ui.ts
      var React = __toESM(require("react"), 1);
      var h = React.createElement;
      function TodoGlyph({ size = 18 }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("rect", { x: 2.25, y: 3.25, width: 11.5, height: 10.5, rx: 2 }),
          h("path", { d: "M2.25 6.5h11.5" }),
          h("path", { d: "M5.25 1.75v2.5M10.75 1.75v2.5" }),
          h("path", { d: "M5.75 9.75l1.4 1.4 2.9-2.9" })
        );
      }
      function BellGlyph({ size = 14 }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.3,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("path", { d: "M4 6.5a4 4 0 1 1 8 0c0 2.2.6 3.2 1.2 3.9.3.4 0 .9-.5.9H3.3c-.5 0-.8-.5-.5-.9C3.4 9.7 4 8.7 4 6.5z" }),
          h("path", { d: "M6.5 13a1.6 1.6 0 0 0 3 0" })
        );
      }
      function PinGlyph({ size = 13, filled = false }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: filled ? "currentColor" : "none",
            stroke: "currentColor",
            strokeWidth: 1.2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("path", { d: "M9.6 1.9l4.5 4.5-2.1 1.1-2.4 2.4-.3 2.2-1.6-1.6L3 14.9l-1.4-1.4 4.4-4.7-1.6-1.6 2.2-.3L9 4z" })
        );
      }
      function PlusGlyph({ size = 13 }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.6,
            strokeLinecap: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("path", { d: "M8 3v10M3 8h10" })
        );
      }
      function SearchGlyph({ size = 14 }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.3,
            strokeLinecap: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("circle", { cx: 7, cy: 7, r: 4.2 }),
          h("path", { d: "M10.2 10.2L14 14" })
        );
      }
      function CloseGlyph({ size = 14 }) {
        return h(
          "svg",
          {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.5,
            strokeLinecap: "round",
            "aria-hidden": "true",
            focusable: "false"
          },
          h("path", { d: "M4 4l8 8M12 4l-8 8" })
        );
      }
      function weekdayLabel(t, iso) {
        return t(`form.weekday.${iso}`);
      }
      function browserToday() {
        const now = /* @__PURE__ */ new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      function dayDiff(left, right) {
        const a = Date.parse(`${left}T00:00:00Z`);
        const b = Date.parse(`${right}T00:00:00Z`);
        if (Number.isNaN(a) || Number.isNaN(b)) return 0;
        return Math.round((a - b) / 864e5);
      }
      function formatInZone(iso, timeZone) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        try {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
          }).formatToParts(date);
          const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
          return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
        } catch {
          return iso;
        }
      }
      function Modal(props) {
        const panelRef = React.useRef(null);
        React.useEffect(() => {
          const previous = document.activeElement;
          const first = panelRef.current?.querySelector(
            'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
          );
          first?.focus();
          const onKeyDown = (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              props.onClose();
              return;
            }
            if (event.key !== "Tab" || panelRef.current === null) return;
            const focusables = panelRef.current.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusables.length === 0) return;
            const firstEl = focusables[0];
            const lastEl = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === firstEl) {
              event.preventDefault();
              lastEl.focus();
            } else if (!event.shiftKey && document.activeElement === lastEl) {
              event.preventDefault();
              firstEl.focus();
            }
          };
          document.addEventListener("keydown", onKeyDown, true);
          return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            previous?.focus?.();
          };
        }, [props]);
        return h(
          "div",
          {
            className: "dtd-backdrop",
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) props.onClose();
            }
          },
          h(
            "div",
            {
              className: "dtd-modal",
              ref: panelRef,
              role: "dialog",
              "aria-modal": "true",
              "aria-label": props.title,
              style: props.wide === true ? { width: "min(880px,100%)" } : void 0
            },
            h(
              "div",
              { className: "dtd-modalHead" },
              h("h2", null, props.title),
              h(
                "button",
                { type: "button", className: "dtd-iconBtn", "aria-label": "Close", onClick: props.onClose },
                h(CloseGlyph, {})
              )
            ),
            h("div", { className: "dtd-modalBody" }, props.children),
            props.footer === void 0 ? null : h("div", { className: "dtd-modalFoot" }, props.footer)
          )
        );
      }
      function ContextMenu(props) {
        const ref = React.useRef(null);
        React.useEffect(() => {
          const close = () => props.onClose();
          const onKeyDown = (event) => {
            if (event.key === "Escape") props.onClose();
          };
          const onPointerDown = (event) => {
            if (ref.current !== null && !ref.current.contains(event.target)) close();
          };
          document.addEventListener("pointerdown", onPointerDown, true);
          document.addEventListener("keydown", onKeyDown, true);
          return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
          };
        }, [props]);
        const width = 176;
        const height = props.items.length * 34 + 10;
        const left = Math.min(props.x, window.innerWidth - width - 12);
        const top = Math.min(props.y, window.innerHeight - height - 12);
        return h(
          "div",
          { className: "dtd-menu", ref, style: { left, top }, role: "menu" },
          props.items.map(
            (item) => h(
              "button",
              {
                key: item.label,
                type: "button",
                role: "menuitem",
                className: item.danger === true ? "danger" : void 0,
                onClick: () => {
                  props.onClose();
                  item.onSelect();
                }
              },
              item.label
            )
          )
        );
      }

      // src/client/panel.ts
      var React8 = __toESM(require("react"), 1);

      // src/client/api.ts
      var BASE = "/api/dsh-todos-diy";
      var ApiError = class extends Error {
        /** Envelope code, e.g. `invalid_cron`. */
        code;
        /** Optional structured details (field-level for validation errors). */
        details;
        /**
         * @param code - Envelope code.
         * @param message - Server diagnostic.
         * @param details - Optional details.
         */
        constructor(code, message, details) {
          super(message);
          this.name = "ApiError";
          this.code = code;
          this.details = details;
        }
      };
      async function request(path, init) {
        let response;
        try {
          response = await fetch(`${BASE}${path}`, {
            ...init,
            credentials: "same-origin",
            headers: {
              accept: "application/json",
              ...init?.body === void 0 ? {} : { "content-type": "application/json" },
              ...init?.headers ?? {}
            }
          });
        } catch (error) {
          throw new ApiError("network_error", error instanceof Error ? error.message : String(error));
        }
        const text = await response.text();
        let parsed = void 0;
        if (text !== "") {
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new ApiError("internal_error", "Server returned a non-JSON response");
          }
        }
        if (!response.ok) {
          const body = parsed;
          const envelope2 = body?.error;
          throw new ApiError(envelope2?.code ?? "internal_error", envelope2?.message ?? response.statusText, envelope2?.details);
        }
        const envelope = parsed;
        return envelope?.value;
      }
      var api = {
        /** Read one snapshot of the given view. */
        snapshot(view, search) {
          const params = new URLSearchParams({ view });
          if (search.trim() !== "") params.set("q", search.trim());
          return request(`/snapshot?${params.toString()}`);
        },
        /** Create one task. */
        create(body) {
          return request("/tasks/create", { method: "POST", body: JSON.stringify(body) });
        },
        /** Update one task. */
        update(id, expectedRevision, patch) {
          return request("/tasks/update", {
            method: "POST",
            body: JSON.stringify({ id, expectedRevision, patch })
          });
        },
        /** Pause a task. */
        pause(id) {
          return request("/tasks/pause", { method: "POST", body: JSON.stringify({ id }) });
        },
        /** Resume a task. */
        resume(id) {
          return request("/tasks/resume", { method: "POST", body: JSON.stringify({ id }) });
        },
        /** Complete a task / skip the current occurrence. */
        complete(id, occurrenceKey) {
          return request("/tasks/complete", {
            method: "POST",
            body: JSON.stringify(occurrenceKey === void 0 ? { id } : { id, occurrenceKey })
          });
        },
        /** Snooze a task. */
        snooze(id, minutes) {
          return request("/tasks/snooze", { method: "POST", body: JSON.stringify({ id, minutes }) });
        },
        /** Pin / unpin a task. */
        pin(id, pinned) {
          return request("/tasks/pin", { method: "POST", body: JSON.stringify({ id, pinned }) });
        },
        /** Soft-delete a task. */
        remove(id) {
          return request("/tasks/delete", { method: "POST", body: JSON.stringify({ id }) });
        },
        /** Restore a soft-deleted task. */
        restore(id) {
          return request("/tasks/restore", { method: "POST", body: JSON.stringify({ id }) });
        },
        /** Preview the next five occurrences of a rule. */
        preview(rule, timeZone) {
          return request("/rules/preview", {
            method: "POST",
            body: JSON.stringify({ rule, timeZone })
          });
        },
        /** Read the archive index. */
        archiveIndex() {
          return request("/archive/index");
        },
        /** Read one archived quarter. */
        archive(quarter, cursor) {
          const params = new URLSearchParams({ quarter });
          if (cursor !== void 0) params.set("cursor", cursor);
          return request(`/archive?${params.toString()}`);
        },
        /** Read settings. */
        settings() {
          return request("/settings/get");
        },
        /** Update settings. */
        updateSettings(patch) {
          return request("/settings/update", { method: "POST", body: JSON.stringify(patch) });
        },
        /** Poll pending reminder cards. */
        due() {
          return request("/due");
        },
        /** Acknowledge one reminder. */
        ack(occurrenceKey, action, minutes) {
          return request("/deliveries/ack", {
            method: "POST",
            body: JSON.stringify({ occurrenceKey, action, channel: "overlay", ...minutes === void 0 ? {} : { minutes } })
          });
        },
        /** Report whether a system notification actually appeared. */
        reportSystem(occurrenceKey, ok, error) {
          return request("/deliveries/report", {
            method: "POST",
            body: JSON.stringify({ occurrenceKey, ok, error: error ?? null })
          });
        },
        /** Download the full export bundle (returns the raw text + filename). */
        async exportData() {
          const response = await fetch(`${BASE}/export`, { credentials: "same-origin" });
          if (!response.ok) throw new ApiError("internal_error", `export failed: ${String(response.status)}`);
          const text = await response.text();
          const disposition = response.headers.get("content-disposition") ?? "";
          const match = /filename="([^"]+)"/.exec(disposition);
          return { text, filename: match?.[1] ?? "dsh-todos-diy.json" };
        },
        /** Import a bundle in replace or merge mode. */
        importData(payload, mode) {
          return request("/import", { method: "POST", body: JSON.stringify({ mode, payload }) });
        },
        /** Health payload (used to display scheduler/storage warnings). */
        health() {
          return request("/health");
        }
      };

      // src/client/task-editor.ts
      var React3 = __toESM(require("react"), 1);

      // src/client/editor-fields.ts
      var React2 = __toESM(require("react"), 1);
      var h2 = React2.createElement;
      function RuleFields({ draft, update, t }) {
        const dateChips = (field, label) => h2(
          "div",
          { className: "dtd-field", key: field },
          h2("span", { className: "dtd-label" }, label),
          h2(
            "div",
            { className: "dtd-chips" },
            draft[field].map(
              (date) => h2(
                "span",
                { key: date, className: "dtd-chip" },
                date,
                h2(
                  "button",
                  {
                    type: "button",
                    "aria-label": `Remove ${date}`,
                    onClick: () => update(field, draft[field].filter((entry) => entry !== date))
                  },
                  "\xD7"
                )
              )
            ),
            h2("input", {
              type: "date",
              className: "dtd-input",
              style: { width: 150 },
              "aria-label": label,
              onChange: (event) => {
                const value = event.target.value;
                if (value === "" || draft[field].includes(value)) return;
                update(field, [...draft[field], value].sort());
                event.target.value = "";
              }
            })
          ),
          h2("span", { className: "dtd-hint" }, t("form.exceptionHint"))
        );
        return [
          h2(
            "div",
            { className: "dtd-field", key: "preset" },
            h2("span", { className: "dtd-label" }, t("form.rule")),
            h2(
              "div",
              { className: "dtd-segment" },
              ["workdays", "weekly", "monthly", "custom"].map(
                (preset) => h2(
                  "button",
                  {
                    key: preset,
                    type: "button",
                    className: "dtd-seg",
                    "aria-pressed": draft.preset === preset,
                    onClick: () => update("preset", preset)
                  },
                  t(`form.preset.${preset}`)
                )
              )
            )
          ),
          draft.preset === "custom" ? h2(
            "div",
            { className: "dtd-field", key: "cron" },
            h2("span", { className: "dtd-label" }, t("form.cron")),
            h2("input", {
              className: "dtd-input",
              value: draft.cron,
              "aria-label": t("form.cron"),
              onChange: (event) => update("cron", event.target.value)
            }),
            h2("span", { className: "dtd-hint" }, t("form.cronHint"))
          ) : h2(
            "div",
            { className: "dtd-row2", key: "time" },
            h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.time")),
              h2("input", {
                type: "time",
                className: "dtd-input",
                value: draft.time,
                "aria-label": t("form.time"),
                onChange: (event) => update("time", event.target.value)
              })
            ),
            draft.preset === "weekly" ? h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.weekdays")),
              h2(
                "div",
                { className: "dtd-segment" },
                [1, 2, 3, 4, 5, 6, 7].map(
                  (iso) => h2(
                    "button",
                    {
                      key: iso,
                      type: "button",
                      className: "dtd-seg",
                      "aria-pressed": draft.weekdays.includes(iso),
                      onClick: () => update(
                        "weekdays",
                        draft.weekdays.includes(iso) ? draft.weekdays.filter((day) => day !== iso) : [...draft.weekdays, iso].sort((a, b) => a - b)
                      )
                    },
                    weekdayLabel(t, iso)
                  )
                )
              )
            ) : null,
            draft.preset === "monthly" ? h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.monthDays")),
              h2("input", {
                className: "dtd-input",
                value: draft.monthDays.join(","),
                "aria-label": t("form.monthDays"),
                onChange: (event) => update(
                  "monthDays",
                  event.target.value.split(",").map((token) => Number(token.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
                )
              })
            ) : null
          ),
          draft.preset === "workdays" ? h2(
            "div",
            { className: "dtd-field", key: "holiday" },
            h2("span", { className: "dtd-label" }, t("form.holidayCalendar")),
            h2(
              "div",
              { className: "dtd-segment" },
              ["CN", "none"].map(
                (calendar) => h2(
                  "button",
                  {
                    key: calendar,
                    type: "button",
                    className: "dtd-seg",
                    "aria-pressed": draft.holidayCalendar === calendar,
                    onClick: () => update("holidayCalendar", calendar)
                  },
                  t(`form.holidayCalendar.${calendar}`)
                )
              )
            ),
            h2("span", { className: "dtd-hint" }, t("form.holidayCalendarHint"))
          ) : null,
          draft.preset === "monthly" ? h2(
            "div",
            { className: "dtd-field", key: "overflow" },
            h2("span", { className: "dtd-label" }, t("form.monthlyOverflow")),
            h2(
              "div",
              { className: "dtd-segment" },
              ["lastDay", "skip"].map(
                (policy) => h2(
                  "button",
                  {
                    key: policy,
                    type: "button",
                    className: "dtd-seg",
                    "aria-pressed": draft.monthlyOverflow === policy,
                    onClick: () => update("monthlyOverflow", policy)
                  },
                  t(`form.monthlyOverflow.${policy}`)
                )
              )
            )
          ) : null,
          dateChips("skipDates", t("form.skipDates")),
          dateChips("extraWorkdays", t("form.extraWorkdays"))
        ];
      }
      function OnceFields({ draft, update, t }) {
        return [
          h2(
            "div",
            { className: "dtd-row2", key: "window" },
            h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.startAt")),
              h2("input", {
                type: "datetime-local",
                className: "dtd-input",
                value: draft.startAt,
                "aria-label": t("form.startAt"),
                onChange: (event) => update("startAt", event.target.value)
              })
            ),
            h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.endAt")),
              h2("input", {
                type: "datetime-local",
                className: "dtd-input",
                value: draft.endAt,
                "aria-label": t("form.endAt"),
                onChange: (event) => update("endAt", event.target.value)
              })
            )
          ),
          h2("span", { className: "dtd-hint", key: "hint" }, t("form.onceHint"))
        ];
      }
      function BasicFields({ draft, update, t }) {
        return [
          h2(
            "div",
            { className: "dtd-field" },
            h2("span", { className: "dtd-label" }, t("form.kind")),
            h2(
              "div",
              { className: "dtd-segment" },
              ["recurring", "once"].map(
                (kind) => h2(
                  "button",
                  {
                    key: kind,
                    type: "button",
                    className: "dtd-seg",
                    "aria-pressed": draft.kind === kind,
                    onClick: () => update("kind", kind)
                  },
                  t(`form.kind.${kind}`)
                )
              )
            ),
            h2("span", { className: "dtd-hint" }, t(`form.kind.${draft.kind}Hint`))
          ),
          h2(
            "div",
            { className: "dtd-field" },
            h2("span", { className: "dtd-label" }, t("form.name")),
            h2("input", {
              className: "dtd-input",
              value: draft.title,
              maxLength: 200,
              placeholder: t("form.namePlaceholder"),
              "aria-label": t("form.name"),
              onChange: (event) => update("title", event.target.value)
            }),
            h2("span", { className: "dtd-hint" }, t("form.nameHint"))
          ),
          h2(
            "div",
            { className: "dtd-field" },
            h2("span", { className: "dtd-label" }, t("form.description")),
            h2("textarea", {
              className: "dtd-textarea",
              value: draft.description,
              maxLength: 2e3,
              placeholder: t("form.descriptionPlaceholder"),
              "aria-label": t("form.description"),
              onChange: (event) => update("description", event.target.value)
            })
          ),
          h2(
            "div",
            { className: "dtd-row2" },
            h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.dueDate")),
              h2("input", {
                type: "date",
                className: "dtd-input",
                value: draft.dueDate,
                "aria-label": t("form.dueDate"),
                onChange: (event) => update("dueDate", event.target.value)
              }),
              h2("span", { className: "dtd-hint" }, t("form.dueDateHint"))
            ),
            h2(
              "div",
              { className: "dtd-field" },
              h2("span", { className: "dtd-label" }, t("form.timeZone")),
              h2("input", {
                className: "dtd-input",
                value: draft.timeZone,
                "aria-label": t("form.timeZone"),
                onChange: (event) => update("timeZone", event.target.value)
              })
            )
          )
        ];
      }

      // src/client/task-editor.ts
      var h3 = React3.createElement;
      function emptyDraft(timeZone) {
        return {
          kind: "recurring",
          title: "",
          description: "",
          dueDate: "",
          preset: "workdays",
          time: "09:00",
          timeZone,
          weekdays: [1],
          monthDays: [1],
          cron: "0 9 * * 1-5",
          holidayCalendar: "CN",
          monthlyOverflow: "lastDay",
          skipDates: [],
          extraWorkdays: [],
          startAt: "",
          endAt: "",
          channels: ["overlay"],
          advanceMinutes: 0,
          sound: false,
          template: "{title}\uFF5C{time}\n{note}"
        };
      }
      function draftFromTask(task, fallbackZone) {
        const base = emptyDraft(fallbackZone);
        const rule = task.rule;
        const draft = {
          ...base,
          kind: task.kind,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ?? "",
          channels: task.notify.channels,
          advanceMinutes: task.notify.advanceMinutes,
          sound: task.notify.sound,
          template: task.notify.template
        };
        if (rule !== null) {
          const cron = rule.cron.split(/\s+/);
          draft.preset = rule.preset;
          draft.timeZone = rule.timeZone;
          draft.time = `${(cron[1] ?? "9").padStart(2, "0")}:${(cron[0] ?? "0").padStart(2, "0")}`;
          draft.cron = rule.cron;
          draft.holidayCalendar = rule.holidayCalendar;
          draft.monthlyOverflow = rule.monthlyOverflow;
          draft.skipDates = [...rule.skipDates];
          draft.extraWorkdays = [...rule.extraWorkdays];
          if (rule.preset === "weekly") {
            draft.weekdays = (cron[4] ?? "1").split(",").map((token) => {
              const value = Number(token);
              return value === 0 ? 7 : value;
            });
          }
          if (rule.preset === "monthly") {
            draft.monthDays = (cron[2] ?? "1").split(",").map(Number);
          }
        }
        if (task.once !== null) {
          draft.startAt = toLocalInput(task.once.startAt, rule?.timeZone ?? fallbackZone);
          draft.endAt = toLocalInput(task.once.endAt, rule?.timeZone ?? fallbackZone);
        }
        return draft;
      }
      function toLocalInput(iso, timeZone) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "";
        try {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
          }).formatToParts(date);
          const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
          return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
        } catch {
          return "";
        }
      }
      function draftToPayload(draft) {
        const notify = {
          channels: draft.channels.includes("overlay") ? draft.channels : ["overlay", ...draft.channels],
          template: draft.template,
          advanceMinutes: draft.advanceMinutes,
          sound: draft.sound
        };
        const base = {
          title: draft.title,
          description: draft.description,
          dueDate: draft.dueDate === "" ? null : draft.dueDate,
          notify
        };
        if (draft.kind === "once") {
          return {
            ...base,
            kind: "once",
            timeZone: draft.timeZone,
            once: { startAt: draft.startAt, endAt: draft.endAt }
          };
        }
        const rule = {
          preset: draft.preset,
          timeZone: draft.timeZone,
          skipDates: draft.skipDates,
          extraWorkdays: draft.extraWorkdays
        };
        if (draft.preset === "workdays") {
          rule["time"] = draft.time;
          rule["holidayCalendar"] = draft.holidayCalendar;
        }
        if (draft.preset === "weekly") {
          rule["time"] = draft.time;
          rule["weekdays"] = draft.weekdays;
        }
        if (draft.preset === "monthly") {
          rule["time"] = draft.time;
          rule["monthDays"] = draft.monthDays;
          rule["monthlyOverflow"] = draft.monthlyOverflow;
        }
        if (draft.preset === "custom") {
          rule["cron"] = draft.cron;
        }
        return { ...base, kind: "recurring", rule };
      }
      function TaskEditor(props) {
        const { t } = props;
        const [draft, setDraft] = React3.useState(props.initial);
        const [error, setError] = React3.useState(null);
        const [saving, setSaving] = React3.useState(false);
        const [preview, setPreview] = React3.useState([]);
        const update = (key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
        };
        React3.useEffect(() => {
          let cancelled = false;
          const timer = window.setTimeout(() => {
            const payload = draftToPayload(draft);
            const rule = payload["rule"];
            if (rule === void 0) {
              setPreview([]);
              return;
            }
            void api.preview(rule, draft.timeZone).then((result) => {
              if (!cancelled) setPreview(result.times);
            }).catch(() => {
              if (!cancelled) setPreview([]);
            });
          }, 350);
          return () => {
            cancelled = true;
            window.clearTimeout(timer);
          };
        }, [draft]);
        const save = async () => {
          setError(null);
          if (draft.title.trim() === "") {
            setError(t("form.required"));
            return;
          }
          if (draft.kind === "once" && draft.startAt !== "" && draft.endAt !== "" && draft.endAt <= draft.startAt) {
            setError(t("form.endAfterStart"));
            return;
          }
          setSaving(true);
          try {
            const payload = draftToPayload(draft);
            const saved = props.editingId === null ? await api.create(payload) : await api.update(props.editingId, props.editingRevision ?? 1, payload);
            props.onSaved(saved);
          } catch (caught) {
            if (caught instanceof ApiError) {
              const translated = t(`error.${caught.code}`);
              setError(
                caught.code === "invalid_cron" ? t("form.invalidCron", { message: caught.message }) : translated === `error.${caught.code}` ? caught.message : translated
              );
            } else {
              setError(String(caught));
            }
          } finally {
            setSaving(false);
          }
        };
        const ruleFields = draft.kind === "recurring" ? h3(RuleFields, { draft, update, t }) : h3(OnceFields, { draft, update, t });
        return h3(
          Modal,
          {
            title: props.editingId === null ? t("form.title.new") : t("form.title.edit"),
            onClose: props.onClose,
            wide: true,
            footer: [
              h3("button", { key: "cancel", type: "button", className: "dtd-btn ghost", onClick: props.onClose }, t("form.cancel")),
              h3(
                "button",
                { key: "save", type: "button", className: "dtd-btn", disabled: saving, onClick: () => {
                  void save();
                } },
                saving ? t("state.saving") : t("form.save")
              )
            ]
          },
          error === null ? null : h3("div", { className: "dtd-error", role: "alert" }, error),
          h3(BasicFields, { draft, update, t }),
          ruleFields,
          h3(
            "div",
            { className: "dtd-field" },
            h3("span", { className: "dtd-label" }, t("form.notify")),
            h3(
              "label",
              { className: "dtd-check-row" },
              h3("input", { type: "checkbox", checked: true, disabled: true }),
              t("form.notify.overlay")
            ),
            h3(
              "label",
              { className: "dtd-check-row" },
              h3("input", {
                type: "checkbox",
                checked: draft.channels.includes("system"),
                onChange: (event) => update(
                  "channels",
                  event.target.checked ? [.../* @__PURE__ */ new Set([...draft.channels, "system"])] : draft.channels.filter((channel) => channel !== "system")
                )
              }),
              t("form.notify.system")
            )
          ),
          h3(
            "div",
            { className: "dtd-row2" },
            h3(
              "div",
              { className: "dtd-field" },
              h3("span", { className: "dtd-label" }, t("form.advance")),
              h3("input", {
                type: "number",
                min: 0,
                max: 1440,
                className: "dtd-input",
                value: draft.advanceMinutes,
                "aria-label": t("form.advance"),
                onChange: (event) => update("advanceMinutes", Math.max(0, Math.min(1440, Number(event.target.value) || 0)))
              }),
              h3("span", { className: "dtd-hint" }, t("form.advanceHint"))
            ),
            h3(
              "div",
              { className: "dtd-field" },
              h3("span", { className: "dtd-label" }, t("form.sound")),
              h3(
                "label",
                { className: "dtd-check-row" },
                h3("input", {
                  type: "checkbox",
                  checked: draft.sound,
                  onChange: (event) => update("sound", event.target.checked)
                }),
                t("form.sound")
              )
            )
          ),
          h3(
            "div",
            { className: "dtd-field" },
            h3("span", { className: "dtd-label" }, t("form.preview")),
            h3(
              "pre",
              { className: "dtd-preview" },
              preview.length === 0 ? t("form.previewEmpty") : preview.map((time) => formatPreview(time, draft.timeZone)).join("\n")
            )
          )
        );
      }
      function formatPreview(iso, timeZone) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        try {
          const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
          }).formatToParts(date);
          const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
          return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
        } catch {
          return iso;
        }
      }

      // src/client/settings-modal.ts
      var React4 = __toESM(require("react"), 1);
      var h4 = React4.createElement;
      function SettingsModal(props) {
        const { t } = props;
        const base = props.initial ?? {
          timeZone: "Asia/Shanghai",
          tickIntervalMs: 6e4,
          graceMinutes: 5,
          defaultChannels: ["overlay"],
          dnd: { enabled: false, start: "22:00", end: "08:00", weekdaysOnly: false },
          retentionDays: 90
        };
        const [timeZone, setTimeZone] = React4.useState(base.timeZone);
        const [graceMinutes, setGraceMinutes] = React4.useState(base.graceMinutes);
        const [dnd, setDnd] = React4.useState(base.dnd);
        const [channels, setChannels] = React4.useState(base.defaultChannels);
        const [error, setError] = React4.useState(null);
        const [saving, setSaving] = React4.useState(false);
        const save = async () => {
          setSaving(true);
          setError(null);
          try {
            const saved = await api.updateSettings({
              timeZone,
              graceMinutes,
              dnd,
              defaultChannels: channels.includes("overlay") ? channels : ["overlay", ...channels]
            });
            props.onSaved(saved);
          } catch (caught) {
            setError(caught instanceof ApiError ? t(`error.${caught.code}`) : String(caught));
          } finally {
            setSaving(false);
          }
        };
        return h4(
          Modal,
          {
            title: t("settings.title"),
            onClose: props.onClose,
            footer: [
              h4("button", { key: "c", type: "button", className: "dtd-btn ghost", onClick: props.onClose }, t("form.cancel")),
              h4(
                "button",
                { key: "s", type: "button", className: "dtd-btn", disabled: saving, onClick: () => void save() },
                saving ? t("state.saving") : t("form.save")
              )
            ]
          },
          error === null ? null : h4("div", { className: "dtd-error", role: "alert" }, error),
          h4(
            "div",
            { className: "dtd-field" },
            h4("span", { className: "dtd-label" }, t("settings.timeZone")),
            h4("input", {
              className: "dtd-input",
              value: timeZone,
              "aria-label": t("settings.timeZone"),
              onChange: (event) => setTimeZone(event.target.value)
            }),
            h4("span", { className: "dtd-hint" }, t("settings.timeZoneHint"))
          ),
          h4(
            "div",
            { className: "dtd-field" },
            h4("span", { className: "dtd-label" }, t("settings.grace")),
            h4("input", {
              type: "number",
              min: 0,
              max: 60,
              className: "dtd-input",
              value: graceMinutes,
              "aria-label": t("settings.grace"),
              onChange: (event) => setGraceMinutes(Math.max(0, Math.min(60, Number(event.target.value) || 0)))
            }),
            h4("span", { className: "dtd-hint" }, t("settings.graceHint"))
          ),
          h4(
            "div",
            { className: "dtd-field" },
            h4(
              "label",
              { className: "dtd-check-row" },
              h4("input", {
                type: "checkbox",
                checked: dnd.enabled,
                onChange: (event) => setDnd({ ...dnd, enabled: event.target.checked })
              }),
              t("settings.dndEnabled")
            ),
            h4(
              "div",
              { className: "dtd-row2" },
              h4(
                "div",
                { className: "dtd-field" },
                h4("span", { className: "dtd-label" }, t("settings.dndStart")),
                h4("input", {
                  type: "time",
                  className: "dtd-input",
                  value: dnd.start,
                  "aria-label": t("settings.dndStart"),
                  onChange: (event) => setDnd({ ...dnd, start: event.target.value })
                })
              ),
              h4(
                "div",
                { className: "dtd-field" },
                h4("span", { className: "dtd-label" }, t("settings.dndEnd")),
                h4("input", {
                  type: "time",
                  className: "dtd-input",
                  value: dnd.end,
                  "aria-label": t("settings.dndEnd"),
                  onChange: (event) => setDnd({ ...dnd, end: event.target.value })
                })
              )
            ),
            h4(
              "label",
              { className: "dtd-check-row" },
              h4("input", {
                type: "checkbox",
                checked: dnd.weekdaysOnly,
                onChange: (event) => setDnd({ ...dnd, weekdaysOnly: event.target.checked })
              }),
              t("settings.dndWeekdays")
            ),
            h4("span", { className: "dtd-hint" }, t("settings.dndHint"))
          ),
          h4(
            "div",
            { className: "dtd-field" },
            h4("span", { className: "dtd-label" }, t("settings.channels")),
            h4("label", { className: "dtd-check-row" }, h4("input", { type: "checkbox", checked: true, disabled: true }), t("form.notify.overlay")),
            h4(
              "label",
              { className: "dtd-check-row" },
              h4("input", {
                type: "checkbox",
                checked: channels.includes("system"),
                onChange: (event) => setChannels(
                  event.target.checked ? [.../* @__PURE__ */ new Set([...channels, "system"])] : channels.filter((channel) => channel !== "system")
                )
              }),
              t("form.notify.system")
            )
          ),
          h4(
            "div",
            { className: "dtd-field" },
            h4("span", { className: "dtd-label" }, t("settings.export")),
            h4(
              "div",
              { className: "dtd-segment" },
              h4(
                "button",
                {
                  type: "button",
                  className: "dtd-seg",
                  onClick: () => {
                    void api.exportData().then(({ text, filename }) => {
                      const blob = new Blob([text], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = filename;
                      anchor.click();
                      URL.revokeObjectURL(url);
                    }).catch((caught) => setError(String(caught)));
                  }
                },
                t("settings.export")
              ),
              h4(
                "label",
                { className: "dtd-seg", style: { display: "inline-flex", alignItems: "center", cursor: "pointer" } },
                t("settings.import"),
                h4("input", {
                  type: "file",
                  accept: "application/json,.json",
                  style: { display: "none" },
                  onChange: (event) => {
                    const file = event.target.files?.[0];
                    if (file === void 0) return;
                    void file.text().then((text) => api.importData(JSON.parse(text), "merge")).then(() => props.onClose()).catch((caught) => setError(String(caught)));
                  }
                })
              )
            ),
            h4("span", { className: "dtd-hint" }, t("settings.backup"))
          )
        );
      }

      // src/client/examples.ts
      function buildExamples(timeZone, t) {
        const workday = emptyDraft(timeZone);
        workday.title = t("empty.example1");
        workday.preset = "workdays";
        workday.time = "09:00";
        const monthly = emptyDraft(timeZone);
        monthly.title = t("empty.example2");
        monthly.preset = "monthly";
        monthly.monthDays = [31];
        monthly.monthlyOverflow = "lastDay";
        monthly.time = "17:00";
        const once = emptyDraft(timeZone);
        once.kind = "once";
        once.title = t("empty.example3");
        const tomorrow = new Date(Date.now() + 864e5);
        const pad = (value) => String(value).padStart(2, "0");
        const datePart = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
        once.startAt = `${datePart}T14:00`;
        once.endAt = `${datePart}T18:00`;
        return [
          { key: "workday", draft: workday, label: t("empty.example1") },
          { key: "monthly", draft: monthly, label: t("empty.example2") },
          { key: "once", draft: once, label: t("empty.example3") }
        ];
      }

      // src/client/task-list.ts
      var React7 = __toESM(require("react"), 1);

      // src/client/grouping.ts
      var GROUP_ORDER = ["pinned", "high", "mid", "low", "none", "paused"];
      function groupItems(items) {
        const buckets = {
          pinned: [],
          high: [],
          mid: [],
          low: [],
          none: [],
          paused: []
        };
        for (const item of items) {
          if (item.status === "paused") {
            buckets.paused.push(item);
            continue;
          }
          if (item.pinned) {
            buckets.pinned.push(item);
            continue;
          }
          const key = item.priority.key === "paused" ? "none" : item.priority.key;
          buckets[key].push(item);
        }
        return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }));
      }

      // src/client/task-row.ts
      var React5 = __toESM(require("react"), 1);
      var h5 = React5.createElement;
      function ruleSummary(task, t) {
        if (task.kind === "once" && task.once !== null) {
          const zone = task.timeZone;
          const start = formatInZone(task.once.startAt, zone);
          const end = formatInZone(task.once.endAt, zone);
          return `${t("kind.once")} \xB7 ${start} \u2192 ${end}`;
        }
        const rule = task.rule;
        if (rule === null) return "";
        const cron = rule.cron.split(/\s+/);
        const minute = cron[0] ?? "0";
        const hour = cron[1] ?? "9";
        const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
        if (rule.preset === "workdays") {
          return `${t("form.preset.workdays")} ${time}`;
        }
        if (rule.preset === "weekly") {
          const days = (cron[4] ?? "").split(",").map((token) => Number(token));
          const labels = days.filter((day) => Number.isInteger(day)).map((day) => weekdayLabel(t, day === 0 ? 7 : day)).join("\u3001");
          return `${t("form.preset.weekly")} ${labels} ${time}`;
        }
        if (rule.preset === "monthly") {
          return `${t("form.preset.monthly")} ${cron[2] ?? ""} ${time}`;
        }
        return rule.cron;
      }
      function dueText(task, today, t) {
        if (task.dueDate === null) return { text: t("task.noDue"), overdue: false };
        const diff = dayDiff(task.dueDate, today);
        if (diff < 0) return { text: t("task.overdue", { n: -diff }), overdue: true };
        if (diff === 0) return { text: t("task.today"), overdue: false };
        if (diff === 1) return { text: t("task.tomorrow"), overdue: false };
        if (diff <= 7) return { text: t("task.daysLater", { n: diff }), overdue: false };
        return { text: t("task.dueOn", { date: task.dueDate }), overdue: false };
      }
      function TaskRow(props) {
        const { task, t } = props;
        const due = dueText(task, props.today, t);
        const isPaused = task.status === "paused";
        const nextText = task.nextAt === null ? t("task.noNext") : t("task.nextAt", { time: formatInZone(task.nextAt, task.timeZone) });
        const rowClass = `dtd-row${task.pinned ? " pinned" : ""}`;
        return h5(
          "li",
          {
            className: rowClass,
            "data-testid": "task-row",
            "data-task-id": task.id,
            tabIndex: 0,
            role: "button",
            "aria-label": `${task.title} \u2014 ${due.text}`,
            onClick: props.onOpen,
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                props.onOpen();
              }
            }
          },
          h5("button", {
            type: "button",
            className: "dtd-check",
            "aria-label": t("task.complete"),
            onClick: (event) => {
              event.stopPropagation();
              props.onComplete();
            }
          }),
          h5(
            "div",
            { className: "dtd-rowMain" },
            h5(
              "div",
              { className: "dtd-rowTitle" },
              task.pinned ? h5(PinGlyph, { size: 12, filled: true }) : null,
              h5("span", { className: "t" }, task.title),
              h5("span", { className: `dtd-badge ${task.priority.key}` }, t(`priority.${task.priority.key}`)),
              task.overdue ? h5("span", { className: "dtd-badge overdue" }, t("task.overdue", { n: task.overdueDays ?? 0 })) : null
            ),
            h5(
              "div",
              { className: "dtd-rowSub" },
              h5("span", { className: "dtd-badge kind" }, t(`kind.${task.kind}`)),
              h5("span", null, ruleSummary(task, t)),
              h5("span", { className: "sep" }, "\xB7"),
              h5("span", null, `${task.timeZone} ${task.utcOffset}`)
            )
          ),
          h5(
            "div",
            { className: "dtd-rowRight" },
            h5("span", { className: due.overdue ? "overdue big" : "big" }, due.text),
            h5("span", null, isPaused ? t("priority.paused") : nextText)
          ),
          h5(
            "div",
            { className: "dtd-rowActions", onClick: (event) => event.stopPropagation() },
            h5(
              "button",
              {
                type: "button",
                className: "dtd-iconBtn",
                "aria-label": task.pinned ? t("task.unpin") : t("task.pin"),
                "aria-pressed": task.pinned,
                onClick: props.onPin
              },
              h5(PinGlyph, { size: 13, filled: task.pinned })
            ),
            h5(
              "button",
              {
                type: "button",
                className: "dtd-iconBtn",
                "aria-label": isPaused ? t("task.resume") : t("task.pause"),
                onClick: isPaused ? props.onResume : props.onPause
              },
              isPaused ? "\u25B6" : "\u23F8"
            ),
            h5(
              "button",
              {
                type: "button",
                className: "dtd-iconBtn",
                "aria-label": t("task.more"),
                "aria-haspopup": "menu",
                onClick: (event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  props.onMenu(rect.left, rect.bottom + 4);
                }
              },
              "\u22EF"
            )
          )
        );
      }

      // src/client/archive-view.ts
      var React6 = __toESM(require("react"), 1);
      var h6 = React6.createElement;
      function ArchiveView(props) {
        const { t } = props;
        const [quarters, setQuarters] = React6.useState([]);
        const [selected, setSelected] = React6.useState(null);
        const [items, setItems] = React6.useState([]);
        const [cursor, setCursor] = React6.useState(null);
        const [phase, setPhase] = React6.useState("idle");
        React6.useEffect(() => {
          let cancelled = false;
          void api.archiveIndex().then((result) => {
            if (!cancelled) setQuarters(result.quarters.map((entry) => ({ quarter: entry.quarter, count: entry.count })));
          }).catch(() => {
            if (!cancelled) setQuarters([]);
          });
          return () => {
            cancelled = true;
          };
        }, []);
        const load = React6.useCallback(
          async (quarter, nextCursor) => {
            setPhase("loading");
            try {
              const page = await api.archive(quarter, nextCursor);
              setItems((current) => nextCursor === void 0 ? page.items : [...current, ...page.items]);
              setCursor(page.nextCursor);
              setSelected(quarter);
              setPhase("idle");
            } catch (caught) {
              setPhase(caught instanceof ApiError && caught.code === "not_found" ? "idle" : "error");
            }
          },
          []
        );
        const restore = async (task) => {
          try {
            await api.restore(task.id);
            setItems((current) => current.filter((entry) => entry.id !== task.id));
            setQuarters(
              (current) => current.map((entry) => selected === null ? entry : { ...entry, count: Math.max(0, entry.count - 1) }).filter((entry) => entry.count > 0 || entry.quarter !== selected)
            );
            props.onChanged();
          } catch {
          }
        };
        return h6(
          "div",
          { className: "dtd-archive" },
          h6(
            "div",
            { className: "dtd-segment", role: "tablist", "aria-label": t("archive.history") },
            h6(
              "button",
              {
                type: "button",
                className: "dtd-seg",
                role: "tab",
                "aria-selected": selected === null ? "true" : "false",
                onClick: () => {
                  setSelected(null);
                  setItems([]);
                }
              },
              t("archive.current")
            ),
            quarters.map(
              (entry) => h6(
                "button",
                {
                  key: entry.quarter,
                  type: "button",
                  className: "dtd-seg",
                  role: "tab",
                  "aria-selected": selected === entry.quarter ? "true" : "false",
                  onClick: () => void load(entry.quarter)
                },
                `${entry.quarter} (${String(entry.count)})`
              )
            )
          ),
          selected === null ? props.currentItems.length === 0 ? h6("div", { className: "dtd-center" }, h6("p", null, t("empty.done"))) : h6(
            "ul",
            { className: "dtd-rows" },
            props.currentItems.map(
              (task) => h6(TaskRow, {
                key: task.id,
                task,
                today: props.today,
                t,
                onOpen: () => props.onOpen(task),
                onComplete: () => void 0,
                onPin: () => void 0,
                onPause: () => void 0,
                onResume: () => void 0,
                onMenu: () => void 0,
                onDuplicate: () => void 0,
                onDelete: () => void 0,
                onRemindNow: () => void 0
              })
            )
          ) : phase === "loading" ? h6("div", { className: "dtd-center" }, h6("p", null, t("archive.loading"))) : phase === "error" ? h6("div", { className: "dtd-center" }, h6("p", null, t("archive.error"))) : items.length === 0 ? h6("div", { className: "dtd-center" }, h6("p", null, t("archive.empty"))) : h6(
            "ul",
            { className: "dtd-rows" },
            items.map(
              (task) => h6(
                "li",
                { key: task.id, className: "dtd-row", "data-testid": "archive-row" },
                h6(
                  "div",
                  { className: "dtd-rowMain" },
                  h6("div", { className: "dtd-rowTitle" }, h6("span", { className: "t" }, task.title)),
                  h6(
                    "div",
                    { className: "dtd-rowSub" },
                    h6("span", null, task.doneAt === null ? "" : formatInZone(task.doneAt, task.timeZone)),
                    h6("span", { className: "sep" }, "\xB7"),
                    h6("span", null, task.timeZone)
                  )
                ),
                h6(
                  "button",
                  { type: "button", className: "dtd-btn small ghost", onClick: () => void restore(task) },
                  t("archive.restore")
                )
              )
            ),
            cursor === null ? null : h6(
              "button",
              { type: "button", className: "dtd-btn ghost", onClick: () => void load(selected, cursor) },
              t("overlay.expand")
            )
          )
        );
      }

      // src/client/task-list.ts
      var h7 = React7.createElement;
      function renderRow(task, props) {
        return h7(TaskRow, {
          key: task.id,
          task,
          today: props.today,
          t: props.t,
          onOpen: () => props.onOpen(task),
          onComplete: () => props.onComplete(task),
          onPin: () => props.onPin(task),
          onPause: () => props.onPause(task),
          onResume: () => props.onResume(task),
          onMenu: (x, y) => props.onMenu(task, x, y),
          onDuplicate: () => props.onDuplicate(task),
          onDelete: () => props.onDelete(task),
          onRemindNow: () => props.onRemindNow(task)
        });
      }
      function TaskList(props) {
        const { t, view } = props;
        if (props.phase === "loading") {
          return h7(
            "div",
            { className: "dtd-skeleton", "aria-label": t("state.loading") },
            [0, 1, 2].map((index) => h7("span", { key: index }))
          );
        }
        if (props.phase === "error") {
          const translated = t(`error.${props.errorCode}`);
          return h7(
            "div",
            { className: "dtd-center", role: "alert" },
            h7("span", { className: "glyph" }, h7(TodoGlyph, { size: 36 })),
            h7("h2", null, t("state.errorTitle")),
            h7("p", null, translated === `error.${props.errorCode}` ? t("state.errorHint") : translated),
            h7("button", { type: "button", className: "dtd-btn", onClick: props.onRetry }, t("state.retry"))
          );
        }
        if (props.items.length === 0) {
          return h7(
            "div",
            { className: "dtd-center", "data-testid": "todos-diy-empty" },
            h7("span", { className: "glyph" }, h7(TodoGlyph, { size: 40 })),
            h7("h2", null, t(`empty.${view}`)),
            h7("p", null, t("empty.hint")),
            props.firstRun ? h7(
              "div",
              null,
              h7("p", { style: { marginTop: 12 } }, t("empty.firstTitle")),
              h7(
                "div",
                { className: "dtd-examples" },
                props.examples.map(
                  (example) => h7(
                    "button",
                    {
                      key: example.key,
                      type: "button",
                      className: "dtd-example",
                      onClick: () => props.onUseExample(example.draft)
                    },
                    example.label,
                    h7("small", null, t("empty.useExample"))
                  )
                )
              )
            ) : h7("button", { type: "button", className: "dtd-btn", onClick: props.onNew }, t("panel.new"))
          );
        }
        if (view === "todo") {
          return h7(
            "div",
            { className: "dtd-body" },
            groupItems(props.items).map(
              (group) => h7(
                "div",
                { className: "dtd-group", key: group.key },
                h7(
                  "div",
                  { className: "dtd-groupHead" },
                  h7("b", null, group.key === "pinned" ? `\u{1F4CC} ${t(`group.${group.key}`)}` : t(`group.${group.key}`)),
                  h7("span", { className: "n" }, String(group.items.length)),
                  group.key === "pinned" ? h7("span", { className: "hint" }, t("group.pinnedHint")) : null
                ),
                h7("ul", { className: "dtd-rows" }, group.items.map((task) => renderRow(task, props)))
              )
            )
          );
        }
        if (view === "done") {
          return h7(
            "div",
            { className: "dtd-body" },
            h7(ArchiveView, {
              currentItems: props.items,
              today: props.today,
              t,
              onOpen: props.onOpen,
              onRestore: (task) => props.onRestoreArchived?.(task),
              onChanged: () => props.onRetry()
            })
          );
        }
        return h7(
          "div",
          { className: "dtd-body" },
          h7("ul", { className: "dtd-rows" }, props.items.map((task) => renderRow(task, props)))
        );
      }

      // src/client/panel.ts
      var h8 = React8.createElement;
      var TAB_KEY = "dsh-todos-diy.tab";
      var FIRST_RUN_KEY = "dsh-todos-diy.firstRun";
      function TodoPanel(props) {
        const { t } = props;
        const [view, setView] = React8.useState(() => {
          const stored = window.localStorage.getItem(TAB_KEY);
          return stored === "done" || stored === "overdue" ? stored : "todo";
        });
        const [search, setSearch] = React8.useState("");
        const [items, setItems] = React8.useState([]);
        const [counts, setCounts] = React8.useState({ todo: 0, done: 0, overdue: 0 });
        const [settings, setSettings] = React8.useState(null);
        const [phase, setPhase] = React8.useState("loading");
        const [errorCode, setErrorCode] = React8.useState("internal_error");
        const [editor, setEditor] = React8.useState(null);
        const [menu, setMenu] = React8.useState(null);
        const [toast, setToast] = React8.useState(null);
        const [settingsOpen, setSettingsOpen] = React8.useState(false);
        const [firstRun, setFirstRun] = React8.useState(false);
        const searchRef = React8.useRef(null);
        const today = browserToday();
        const load = React8.useCallback(
          async (target = view, query = search) => {
            setPhase((current) => current === "ready" ? current : "loading");
            try {
              const snapshot = await api.snapshot(target, query);
              setItems(snapshot.items);
              setCounts(snapshot.counts);
              setSettings(snapshot.settings);
              setPhase("ready");
            } catch (caught) {
              setErrorCode(caught instanceof ApiError ? caught.code : "internal_error");
              setPhase("error");
            }
          },
          [view, search]
        );
        React8.useEffect(() => {
          void load(view, "");
        }, [view]);
        React8.useEffect(() => {
          const timer = window.setTimeout(() => {
            void load(view, search);
          }, 250);
          return () => window.clearTimeout(timer);
        }, [search]);
        React8.useEffect(() => {
          window.localStorage.setItem(TAB_KEY, view);
        }, [view]);
        React8.useEffect(() => {
          if (phase !== "ready") return;
          const seen = window.localStorage.getItem(FIRST_RUN_KEY);
          const total = counts.todo + counts.done + counts.overdue;
          setFirstRun(seen === null && total === 0);
        }, [phase, counts]);
        React8.useEffect(() => {
          const handler = () => {
            void load(view, search);
          };
          window.addEventListener("dsh-todos-diy:changed", handler);
          window.addEventListener("visibilitychange", handler);
          return () => {
            window.removeEventListener("dsh-todos-diy:changed", handler);
            window.removeEventListener("visibilitychange", handler);
          };
        }, [view, search]);
        React8.useEffect(() => {
          const onKeyDown = (event) => {
            const target = event.target;
            const typing = target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
            if (typing) return;
            if (event.key === "n" || event.key === "N") {
              event.preventDefault();
              openNew();
            } else if (event.key === "/") {
              event.preventDefault();
              searchRef.current?.focus();
            }
          };
          document.addEventListener("keydown", onKeyDown);
          return () => document.removeEventListener("keydown", onKeyDown);
        }, [settings]);
        const openNew = () => {
          setEditor({ draft: emptyDraft(settings?.timeZone ?? "Asia/Shanghai"), id: null, revision: null });
        };
        const openEdit = (task) => {
          setEditor({ draft: draftFromTask(task, settings?.timeZone ?? "Asia/Shanghai"), id: task.id, revision: task.revision });
        };
        const showToast = (text, undo) => {
          setToast({ text, ...undo === void 0 ? {} : { undo } });
          window.setTimeout(() => setToast(null), undo === void 0 ? 2600 : 5e3);
        };
        const reportError = (caught) => {
          const code = caught instanceof ApiError ? caught.code : "internal_error";
          const translated = t(`error.${code}`);
          showToast(t("toast.error", { message: translated === `error.${code}` ? String(caught) : translated }));
        };
        const mutate = async (work, successText, undo) => {
          try {
            await work();
            await load(view, search);
            window.dispatchEvent(new CustomEvent("dsh-todos-diy:changed"));
            if (successText !== void 0) {
              showToast(
                successText,
                undo === void 0 ? void 0 : () => {
                  void undo().then(() => load(view, search)).catch(reportError);
                }
              );
            }
          } catch (caught) {
            reportError(caught);
          }
        };
        const onComplete = (task) => {
          const previousStatus = task.status;
          void mutate(
            () => api.complete(task.id),
            t("toast.completed"),
            previousStatus === "done" ? void 0 : () => api.restore(task.id)
          );
        };
        const onDelete = (task) => {
          void mutate(() => api.remove(task.id), t("toast.deleted"), () => api.restore(task.id));
        };
        const examples = () => buildExamples(settings?.timeZone ?? "Asia/Shanghai", t);
        const useExample = (draft) => {
          void mutate(async () => {
            await api.create(draftToPayloadOf(draft));
            window.localStorage.setItem(FIRST_RUN_KEY, "1");
          });
        };
        return h8(
          "section",
          { className: "dtd-page", "aria-label": t("panel.title"), "data-testid": "todos-diy-panel" },
          h8(
            "header",
            { className: "dtd-head" },
            h8("div", null, h8("h1", null, t("panel.title")), h8("p", null, t("panel.subtitle"))),
            h8(
              "div",
              { className: "dtd-actions" },
              h8(
                "button",
                { type: "button", className: "dtd-btn ghost", "aria-label": t("panel.settings"), onClick: () => setSettingsOpen(true) },
                t("panel.settings")
              ),
              h8(
                "button",
                { type: "button", className: "dtd-btn", onClick: openNew },
                h8(PlusGlyph, {}),
                t("panel.new")
              )
            )
          ),
          h8(
            "div",
            { className: "dtd-tabs", role: "tablist" },
            ["todo", "done", "overdue"].map(
              (key) => h8(
                "button",
                {
                  key,
                  type: "button",
                  role: "tab",
                  className: "dtd-tab",
                  "aria-selected": view === key ? "true" : "false",
                  onClick: () => setView(key)
                },
                t(`tab.${key}`),
                h8("span", { className: "dtd-count", "aria-hidden": "true" }, String(counts[key]))
              )
            )
          ),
          h8(
            "div",
            { className: "dtd-rules", "aria-label": t("rule.hint") },
            h8("span", null, h8("i", { className: "dtd-dot high" }), t("rule.high")),
            h8("span", null, h8("i", { className: "dtd-dot mid" }), t("rule.mid")),
            h8("span", null, h8("i", { className: "dtd-dot low" }), t("rule.low")),
            h8("span", null, h8("i", { className: "dtd-dot none" }), t("rule.none")),
            h8("span", { className: "refresh" }, t("rule.refresh"))
          ),
          h8(
            "div",
            { className: "dtd-toolbar" },
            h8(
              "div",
              { className: "dtd-search" },
              h8(SearchGlyph, {}),
              h8("input", {
                ref: searchRef,
                type: "search",
                value: search,
                placeholder: t("panel.search"),
                "aria-label": t("panel.search"),
                onChange: (event) => setSearch(event.target.value)
              })
            )
          ),
          h8(TaskList, {
            view,
            phase,
            errorCode,
            items,
            today,
            t,
            firstRun,
            examples: examples(),
            onRetry: () => void load(view, search),
            onNew: openNew,
            onUseExample: useExample,
            onOpen: openEdit,
            onComplete,
            onPin: (task) => void mutate(() => api.pin(task.id, !task.pinned), task.pinned ? t("toast.unpinned") : t("toast.pinned")),
            onPause: (task) => void mutate(() => api.pause(task.id), t("toast.paused")),
            onResume: (task) => void mutate(() => api.resume(task.id), t("toast.resumed")),
            onMenu: (task, x, y) => setMenu({ x, y, task }),
            onDuplicate: (task) => void mutate(async () => {
              const payload = draftToPayloadOf(draftFromTask(task, settings?.timeZone ?? "Asia/Shanghai"));
              delete payload["id"];
              await api.create({ ...payload, title: `${task.title} \u526F\u672C` });
            }),
            onDelete,
            onRemindNow: (task) => void mutate(() => api.snooze(task.id, 1))
          }),
          editor === null ? null : h8(TaskEditor, {
            initial: editor.draft,
            editingId: editor.id,
            editingRevision: editor.revision,
            t,
            onClose: () => setEditor(null),
            onSaved: () => {
              setEditor(null);
              void load(view, search);
              window.dispatchEvent(new CustomEvent("dsh-todos-diy:changed"));
            }
          }),
          menu === null ? null : h8(ContextMenu, {
            x: menu.x,
            y: menu.y,
            onClose: () => setMenu(null),
            items: [
              { label: t("task.edit"), onSelect: () => openEdit(menu.task) },
              { label: t("task.copy"), onSelect: () => void 0 },
              { label: t("task.remindNow"), onSelect: () => void 0 },
              { label: t("task.history"), onSelect: () => void 0 },
              { label: t("task.delete"), danger: true, onSelect: () => onDelete(menu.task) }
            ]
          }),
          settingsOpen ? h8(SettingsModal, {
            t,
            initial: settings,
            onClose: () => setSettingsOpen(false),
            onSaved: (next) => {
              setSettings(next);
              setSettingsOpen(false);
              void load(view, search);
            }
          }) : null,
          toast === null ? null : h8(
            "div",
            { className: "dtd-toast", role: "status" },
            toast.text,
            toast.undo === void 0 ? null : h8(
              "button",
              {
                type: "button",
                onClick: () => {
                  toast.undo?.();
                  setToast(null);
                }
              },
              t("toast.undo")
            )
          )
        );
      }
      function draftToPayloadOf(draft) {
        return draftToPayload(draft);
      }

      // src/client/overlay.ts
      var React9 = __toESM(require("react"), 1);
      var h9 = React9.createElement;
      var POLL_MS = 2e4;
      var PHASE_KEYS = {
        start: "overlay.phase.start",
        end: "overlay.phase.end",
        advance: "overlay.phase.advance"
      };
      function ReminderOverlay(props) {
        const { t } = props;
        const [cards, setCards] = React9.useState([]);
        const [expanded, setExpanded] = React9.useState(false);
        const [error, setError] = React9.useState(null);
        const stackRef = React9.useRef(null);
        const poll = React9.useCallback(async () => {
          try {
            const result = await api.due();
            setCards(result.items);
            setError(null);
            for (const card of result.items) {
              if (!card.channels.includes("system")) continue;
              if (typeof Notification === "undefined") continue;
              if (Notification.permission !== "granted") continue;
              if (document.visibilityState !== "hidden") continue;
              try {
                new Notification(card.title, { body: card.text, tag: card.occurrenceKey });
                await api.reportSystem(card.occurrenceKey, true);
              } catch (caught) {
                await api.reportSystem(card.occurrenceKey, false, caught instanceof Error ? "not-supported" : "unknown");
              }
            }
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "internal_error");
          }
        }, []);
        React9.useEffect(() => {
          void poll();
          const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") void poll();
          }, POLL_MS);
          const onVisible = () => {
            if (document.visibilityState === "visible") void poll();
          };
          document.addEventListener("visibilitychange", onVisible);
          window.addEventListener("dsh-todos-diy:changed", onVisible);
          return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("dsh-todos-diy:changed", onVisible);
          };
        }, [poll]);
        React9.useEffect(() => {
          if (cards.length === 0) return void 0;
          const onKeyDown = (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              void dismissAll();
            }
          };
          document.addEventListener("keydown", onKeyDown, true);
          return () => document.removeEventListener("keydown", onKeyDown, true);
        }, [cards]);
        const act = async (card, action, minutes) => {
          setCards((current) => current.filter((entry) => entry.occurrenceKey !== card.occurrenceKey));
          try {
            await api.ack(card.occurrenceKey, action, minutes);
            window.dispatchEvent(new CustomEvent("dsh-todos-diy:changed"));
          } catch (caught) {
            setCards(
              (current) => current.some((entry) => entry.occurrenceKey === card.occurrenceKey) ? current : [...current, card]
            );
            setError(caught instanceof ApiError ? caught.code : "internal_error");
          }
        };
        const dismissAll = async () => {
          const snapshot = [...cards];
          setCards([]);
          for (const card of snapshot) {
            try {
              await api.ack(card.occurrenceKey, "dismiss");
            } catch {
              setCards(
                (current) => current.some((entry) => entry.occurrenceKey === card.occurrenceKey) ? current : [...current, card]
              );
            }
          }
          window.dispatchEvent(new CustomEvent("dsh-todos-diy:changed"));
        };
        if (cards.length === 0) return null;
        const visible = expanded ? cards : cards.slice(0, 3);
        const hidden = cards.length - visible.length;
        const summaryMode = cards.length >= 10;
        return h9(
          "div",
          {
            className: "dtd-overlay",
            "data-testid": "todos-diy-overlay",
            role: "alertdialog",
            "aria-live": "assertive",
            "aria-label": t("overlay.a11y", { n: cards.length })
          },
          h9(
            "div",
            { className: "dtd-overlayStack", ref: stackRef },
            visible.map(
              (card) => h9(
                "div",
                { key: card.occurrenceKey, className: "dtd-reminder", "data-testid": "reminder-card" },
                h9(
                  "div",
                  { className: "dtd-reminderHead" },
                  h9("span", { className: "glyph" }, h9(BellGlyph, { size: 14 })),
                  h9("span", { className: "dtd-reminderTitle" }, card.title),
                  h9("span", { className: "dtd-reminderTime" }, card.localTime.replace("T", " "))
                ),
                card.phase === null ? null : h9("span", { className: "dtd-badge kind" }, t(PHASE_KEYS[card.phase] ?? "overlay.title")),
                h9("p", { className: "dtd-reminderText" }, card.text),
                h9(
                  "div",
                  { className: "dtd-reminderActions" },
                  h9(
                    "button",
                    { type: "button", className: "dtd-btn small", onClick: () => void act(card, "complete") },
                    t("overlay.complete")
                  ),
                  h9(
                    "button",
                    {
                      type: "button",
                      className: "dtd-btn small ghost",
                      onClick: () => void act(card, "snooze", 15),
                      title: t("overlay.snooze")
                    },
                    `${t("overlay.snooze")} ${t("overlay.snooze15")}`
                  ),
                  h9("span", { className: "grow" }),
                  h9(
                    "button",
                    { type: "button", className: "dtd-btn small ghost", onClick: () => void act(card, "dismiss") },
                    t("overlay.dismiss")
                  )
                )
              )
            ),
            cards.length > 3 ? h9(
              "div",
              {
                className: "dtd-overlayMore",
                role: "button",
                tabIndex: 0,
                onClick: () => setExpanded((value) => !value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded((value) => !value);
                  }
                }
              },
              h9(
                "span",
                null,
                summaryMode ? t("overlay.summary", { n: cards.length }) : t("overlay.more", { n: hidden })
              ),
              h9("span", null, expanded ? t("overlay.collapse") : t("overlay.expand"))
            ) : null,
            error === null ? null : h9("div", { className: "dtd-reminder", role: "alert" }, t(`error.${error}`))
          )
        );
      }

      // src/client/index.ts
      var NS = "todos-diy";
      function apply(ctx) {
        ctx.effect(() => {
          const tag = document.createElement("style");
          tag.dataset.plugin = "dsh-todos-diy";
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
          };
        }, "todos-diy: styles");
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "todos-diy: dictionaries");
        const t = ctx.locale.bind(NS);
        ctx.effect(() => {
          const report = () => {
            try {
              if (typeof Notification === "undefined") return;
              void fetch("/api/dsh-todos-diy/capabilities", {
                method: "POST",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ systemNotification: Notification.permission === "granted" })
              }).catch(() => void 0);
            } catch {
            }
          };
          report();
          return () => void 0;
        }, "todos-diy: capabilities");
        ctx.slots.inject(
          "sidebar.panellist",
          () => ctx.slots.register(
            { name: "sidebar.panellist", id: "todos-diy", order: 30, locale: NS, label: () => t("entry.label") },
            TodoGlyph
          )
        );
        ctx.slots.inject(
          "main",
          () => ctx.slots.register(
            { name: "main", key: "todos-diy", locale: NS },
            function MainPanel(props) {
              return React10.createElement(TodoPanel, { t: props.t ?? t });
            }
          )
        );
        ctx.slots.inject(
          "shell.overlay",
          () => ctx.slots.register(
            { name: "shell.overlay", id: "todos-diy-overlay", order: 60, locale: NS },
            function Overlay(props) {
              return React10.createElement(ReminderOverlay, { t: props.t ?? t });
            }
          )
        );
      }
      var index_default = { apply, inject: ["slots", "locale"] };

    })(module, exports, require)
    return module.exports.default ?? module.exports
  },
})
