// Split build output: the host allows 1000000 bytes per file, the original
// module was 1277943. The parts are plain text; this loader joins them, fixes
// relative specifiers for Blob evaluation, then re-exports the same names.
const here = import.meta.url;
const base = new URL("./", here);
const parts = [
	'BcUlQOG8.js.part1',
	'BcUlQOG8.js.part2'
];
const source = (
	await Promise.all(parts.map((part) => fetch(new URL(part, base)).then((r) => r.text())))
).join("");
const RELATIVE = /(\bfrom\s*|\bimport\s*\(?\s*)(["'`])(\.{1,2}\/[^"'`]+)\2/g;
const fixed = source
	.replace(RELATIVE, (match, lead, quote, spec) => lead + quote + new URL(spec, base).href + quote)
	.replace(/import\.meta\.url/g, JSON.stringify(here));
const mod = await import(URL.createObjectURL(new Blob([fixed], { type: "text/javascript" })));
export const C = mod.C;
export const D = mod.D;
export const E = mod.E;
export const O = mod.O;
export const S = mod.S;
export const T = mod.T;
export const _ = mod._;
export const a = mod.a;
export const b = mod.b;
export const c = mod.c;
export const d = mod.d;
export const f = mod.f;
export const g = mod.g;
export const h = mod.h;
export const i = mod.i;
export const l = mod.l;
export const m = mod.m;
export const n = mod.n;
export const o = mod.o;
export const p = mod.p;
export const r = mod.r;
export const s = mod.s;
export const t = mod.t;
export const u = mod.u;
export const v = mod.v;
export const w = mod.w;
export const x = mod.x;
export const y = mod.y;
