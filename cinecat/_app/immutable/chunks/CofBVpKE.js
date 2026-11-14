// Split build output: the host allows 1000000 bytes per file, the original
// module was 1159239. The parts are plain text; this loader joins them, fixes
// relative specifiers for Blob evaluation, then re-exports the same names.
const here = import.meta.url;
const base = new URL("./", here);
const parts = [
	'CofBVpKE.js.part1',
	'CofBVpKE.js.part2'
];
const source = (
	await Promise.all(parts.map((part) => fetch(new URL(part, base)).then((r) => r.text())))
).join("");
const RELATIVE = /(\bfrom\s*|\bimport\s*\(?\s*)(["'`])(\.{1,2}\/[^"'`]+)\2/g;
const fixed = source
	.replace(RELATIVE, (match, lead, quote, spec) => lead + quote + new URL(spec, base).href + quote)
	.replace(/import\.meta\.url/g, JSON.stringify(here));
const mod = await import(URL.createObjectURL(new Blob([fixed], { type: "text/javascript" })));
export const a = mod.a;
export const i = mod.i;
export const n = mod.n;
export const o = mod.o;
export const r = mod.r;
export const t = mod.t;
