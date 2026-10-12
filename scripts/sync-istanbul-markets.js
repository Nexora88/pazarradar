const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const SOURCE_URL = "https://www.hal.gov.tr/Sayfalar/Pazar-Yerleri.aspx?sid=34";
const DATA_PATH = path.join(__dirname, "..", "data", "istanbul-markets.json");
const DAYS = {
  pzt: "Pazartesi",
  pazartesi: "Pazartesi",
  sal: "Salı",
  salı: "Salı",
  çrş: "Çarşamba",
  çarşamba: "Çarşamba",
  prş: "Perşembe",
  perşembe: "Perşembe",
  cuma: "Cuma",
  cmt: "Cumartesi",
  cumartesi: "Cumartesi",
  pazar: "Pazar",
};

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
      if (code[0] === "#") {
        const hex = code[1]?.toLowerCase() === "x";
        const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
      }
      return (
        { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" }[code.toLowerCase()] ??
        entity
      );
    })
    .replace(/\s+/g, " ")
    .trim();
}

const normalize = (value) => value.normalize("NFC").replace(/\s+/g, " ").trim();

function parseOfficialTable(html) {
  const tableId = html.search(/id=["'][^"']*gvListe["']/i);
  const marker = tableId >= 0 ? tableId : html.indexOf("gvListe");
  if (marker < 0) throw new Error("Resmî pazar tablosu bulunamadı.");
  const start = html.lastIndexOf("<table", marker);
  const end = html.indexOf("</table>", marker);
  if (start < 0 || end < 0) throw new Error("Resmî pazar tablosu bozuk.");
  const table = html.slice(start, end + "</table>".length);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const markets = [];
  for (const row of rows.slice(1)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      normalize(decodeHtml(cell[1])),
    );
    if (cells.length < 7) continue;
    const [name, type, address, city, district, neighborhood, dayText] = cells;
    if (normalize(city).toLocaleLowerCase("tr-TR") !== "istanbul" || !name || !district || !address)
      continue;
    const gunler = [
      ...new Set(
        dayText
          .split(/[,;/]+/)
          .map((day) => DAYS[day.trim().toLocaleLowerCase("tr-TR")])
          .filter(Boolean),
      ),
    ];
    const ad = normalize(name);
    const ilce = normalize(district);
    const adres = normalize(address);
    const sourceKey = crypto
      .createHash("sha256")
      .update([ad, ilce, adres, gunler.join(",")].join("|").toLocaleLowerCase("tr-TR"))
      .digest("hex");
    const lowerName = ad.toLocaleLowerCase("tr-TR");
    const etiketler = [];
    if (lowerName.includes("sosyete")) etiketler.push("sosyete");
    if (lowerName.includes("organik")) etiketler.push("organik");
    markets.push({
      sourceKey,
      ad,
      il: "İstanbul",
      ilce,
      mahalle: normalize(neighborhood),
      adres,
      gunler,
      etiketler,
      kaynak: "T.C. Ticaret Bakanlığı Hal Kayıt Sistemi",
      kaynakUrl: SOURCE_URL,
      kaynakGuncelleme: new Date().toISOString(),
      koordinatDurumu: "kaynakta-yok",
      tur: normalize(type),
    });
  }
  const unique = [...new Map(markets.map((market) => [market.sourceKey, market])).values()];
  if (unique.length < 400)
    throw new Error(
      `İstanbul kayıt sayısı beklenenden az: ${unique.length}; kaynak değişmiş olabilir.`,
    );
  return unique;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StreetBazaars/1.0; Istanbul market directory)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Resmî kaynak HTTP ${response.status}`);
  const markets = parseOfficialTable(await response.text());
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(
      {
        metadata: {
          name: "Street Bazaars · İstanbul",
          city: "İstanbul",
          source: "T.C. Ticaret Bakanlığı Hal Kayıt Sistemi",
          sourceUrl: SOURCE_URL,
          fetchedAt: new Date().toISOString(),
          count: markets.length,
          note: "Resmî listedeki pazar adı, ilçe, semt, adres ve kuruluş günleri. Kaynakta olmayan koordinatlar ve fiyatlar uydurulmaz.",
        },
        markets,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`Resmî İstanbul pazar kaydı alındı: ${markets.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("İstanbul pazar verisi alınamadı:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseOfficialTable, SOURCE_URL };
