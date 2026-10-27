// Generate DeepRest PNG icons from the master SVG (favicon/apple touch/Android)
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(path.join(__dirname, "../src/app/icon.svg"));

async function main() {
  const outDir = path.join(__dirname, "../public");
  const appDir = path.join(__dirname, "../src/app");

  await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));
  await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
  await sharp(svg, { density: 300 }).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png"));
  await sharp(svg, { density: 300 }).resize(96, 96).png().toFile(path.join(appDir, "icon.png"));
  console.log("icons written: public/icon-512.png, public/icon-192.png, src/app/apple-icon.png, src/app/icon.png");
}

main().catch((e) => { console.error(e); process.exit(1); });
