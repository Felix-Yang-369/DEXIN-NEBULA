import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const checks = [
  ["页面组件中不得直接使用十六进制颜色", /#[0-9a-f]{3,8}/gi],
  ["不得使用装饰性渐变", /gradient/gi],
  ["不得使用 13px 以上的任意圆角或 2xl 以上圆角", /rounded-\[(?:1[3-9]|2\d|3[0-2])px\]|rounded-(?:2xl|3xl|4xl)/g],
  ["正文不得小于 11px", /text-\[(?:[0-9]|10|11)px\]/g],
  ["普通组件不得使用任意阴影", /shadow-\[[^\]]+\]/g],
  ["普通内容不得使用悬浮上移效果", /hover:-translate-y-/g],
  ["不得使用装饰性多色类", /(?:bg|text|border)-(?:blue|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/g],
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && /\.(?:tsx|jsx)$/.test(entry.name) ? [target] : [];
  });
}

const violations = [];
for (const file of sourceFiles(root)) {
  const source = readFileSync(file, "utf8");
  for (const [message, pattern] of checks) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${path.relative(process.cwd(), file)}:${line} ${message}：${match[0]}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("UI V3 样式治理检查通过");
