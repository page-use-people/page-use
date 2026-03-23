import {twind, cssom, tx as tx$} from '@twind/core';
import presetTailwind from '@twind/preset-tailwind';

const target = new CSSStyleSheet();

export const tw = /* #__PURE__ */ twind(
    {presets: [presetTailwind()]},
    cssom(target),
);

export const tx = /* #__PURE__ */ tx$.bind(tw);
export const twindTarget = target;

const scrollbarSheet = new CSSStyleSheet();
scrollbarSheet.replaceSync(`
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--pu-bg); }
  ::-webkit-scrollbar-thumb { background: var(--pu-divider); }
  ::-webkit-scrollbar-thumb:hover { background: var(--pu-muted); }
`);
export const scrollbarStyles = scrollbarSheet;
