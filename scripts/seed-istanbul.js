require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const Pazar = require("../models/Pazar");

async function main() {
  const dataPath = path.join(__dirname, "..", "data", "istanbul-markets.json");
  const snapshot = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const markets = snapshot.markets;
  if (!Array.isArray(markets) || markets.length < 400 || markets.some((market) => market.il !== "İstanbul" || !market.sourceKey)) {
    throw new Error("İstanbul veri dosyası geçersiz veya eksik; veritabanı değiştirilmedi.");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI tanımlanmalı.");
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: Number(process.env.DB_TIMEOUT_MS) || 10000,
  });
  await Pazar.createIndexes();
  const operations = markets.map((market) => ({
    updateOne: {
      filter: { sourceKey: market.sourceKey },
      update: {
        $set: {
          ad: market.ad, il: "İstanbul", ilce: market.ilce, mahalle: market.mahalle,
          adres: market.adres, gunler: market.gunler, etiketler: market.etiketler,
          sourceKey: market.sourceKey, tur: market.tur, kaynak: market.kaynak,
          kaynakUrl: market.kaynakUrl, kaynakGuncelleme: new Date(market.kaynakGuncelleme),
          koordinatDurumu: "kaynakta-yok", aktif: true,
        },
        $setOnInsert: { aciklama: "", ortalamaPuan: 0, toplamYorum: 0, fiyatEndeksi: 50 },
      },
      upsert: true,
    },
  }));
  const result = await Pazar.bulkWrite(operations, { ordered: false });
  console.log(JSON.stringify({
    source: snapshot.metadata.source, snapshotFetchedAt: snapshot.metadata.fetchedAt,
    sourceRecords: markets.length, matched: result.matchedCount,
    modified: result.modifiedCount, inserted: result.upsertedCount,
    totalActiveIstanbulMarkets: await Pazar.countDocuments({ il: "İstanbul", aktif: true }),
    note: "Kaynakta bulunmayan koordinatlar ve fiyatlar uydurulmadı.",
  }, null, 2));
}
main()
  .catch((error) => { console.error("İstanbul pazar verileri içe aktarılamadı:", error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect().catch(() => {}); });
