// Generate DeepRest icon assets from the master SVG (scripts/assets/icon.svg).
// NOTE: icons live in public/ only — an icon.svg/icon.png/apple-icon.png inside
// src/app/ crashes the Next 16.1.x Turbopack production build (turbopack panic
// "Dependency tracking is disabled..."), so never move them back into src/app.
// layout.tsx references them via metadata.icons -> public URLs.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(path.join(__dirname, "assets/icon.svg"));
const outDir = path.join(__dirname, "../public");

async function makeIco(sizes) {
  const pngs = [];
  for (const s of sizes) pngs.push(await sharp(svg, { density: 300 }).resize(s, s).png().toBuffer());
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + sizes.length * 16;
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16);
    e[0] = sizes[i]; e[1] = sizes[i];
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += pngs[i].length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

async function main() {
  await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));
  await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
  await sharp(svg, { density: 300 }).resize(180, 180).png().toFile(path.join(outDir, "apple-icon.png"));
  fs.writeFileSync(path.join(outDir, "favicon.ico"), await makeIco([16, 32, 48]));
  fs.writeFileSync(path.join(__dirname, "../mobile/assets/icon.png"),
    await sharp(svg, { density: 600 }).resize(1024, 1024).flatten({ background: "#070b1e" }).png().toBuffer());
  console.log("icons written: public/{icon-512,icon-192,apple-icon}.png, public/favicon.ico, mobile/assets/icon.png");
}

main().catch((e) => { console.error(e); process.exit(1); });
