const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Tezgah = require("../models/Tezgah");
const Pazar = require("../models/Pazar");
const auth = require("../middleware/auth");
const esnaf = require("../middleware/esnaf");

const safeError = (res, error, fallback = "İşlem tamamlanamadı.") => {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Gönderilen bilgiler geçersiz." });
  }
  console.error("[tezgah]", error?.message || error);
  return res.status(500).json({ success: false, message: fallback });
};
const validId = id => mongoose.isValidObjectId(id);
const ownsStall = (stall, user) => user?.role === "admin" || String(stall.esnaf) === String(user?.id);

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { aktif: true };
    if (req.query.pazar) {
      if (!validId(req.query.pazar)) return res.status(400).json({ success: false, message: "Pazar kimliği geçersiz." });
      query.pazar = req.query.pazar;
    }
    if (req.query.search) {
      const search = String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [{ tezgahAdi: { $regex: search, $options: "i" } }, { aciklama: { $regex: search, $options: "i" } }];
    }
    const [total, data] = await Promise.all([
      Tezgah.countDocuments(query),
      Tezgah.find(query).populate("pazar", "ad ilce mahalle adres").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    res.json({ success: true, total, page, limit, totalPages: Math.ceil(total / limit), data });
  } catch (error) { safeError(res, error, "Tezgâhlar yüklenemedi."); }
});

router.get("/:id/urun/:urunId/fiyatlar", async (req, res) => {
  try {
    if (!validId(req.params.id) || !validId(req.params.urunId)) return res.status(400).json({ success: false, message: "Kimlik bilgisi geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.id, aktif: true });
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    const product = stall.urunler.id(req.params.urunId);
    if (!product) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });
    res.json({ success: true, data: { urun: product.isim, birim: product.birim, guncelFiyat: product.guncelFiyat, fiyatGecmisi: product.fiyatGecmisi } });
  } catch (error) { safeError(res, error, "Fiyat geçmişi alınamadı."); }
});

router.get("/:id/yorumlar", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Tezgâh kimliği geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.id, aktif: true }).select("yorumlar ortalamaPuan toplamYorum");
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    res.json({ success: true, toplam: stall.toplamYorum, ortalamaPuan: stall.ortalamaPuan, yorumlar: stall.yorumlar });
  } catch (error) { safeError(res, error, "Yorumlar alınamadı."); }
});

router.get("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Tezgâh kimliği geçersiz." });
    const data = await Tezgah.findOne({ _id: req.params.id, aktif: true }).populate("pazar", "ad il ilce mahalle adres konum gunler saatler");
    if (!data) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    res.json({ success: true, data });
  } catch (error) { safeError(res, error, "Tezgâh alınamadı."); }
});

router.post("/", auth, esnaf, async (req, res) => {
  try {
    const { pazar, tezgahAdi, aciklama } = req.body || {};
    if (!validId(pazar) || !String(tezgahAdi || "").trim()) return res.status(400).json({ success: false, message: "Geçerli bir pazar ve tezgâh adı zorunludur." });
    const market = await Pazar.findOne({ _id: pazar, aktif: true }).select("_id");
    if (!market) return res.status(404).json({ success: false, message: "Aktif pazar bulunamadı." });
    const data = await Tezgah.create({ pazar, tezgahAdi: String(tezgahAdi).trim(), aciklama: String(aciklama || "").trim(), esnaf: req.user.id });
    res.status(201).json({ success: true, message: "Tezgâh oluşturuldu.", data });
  } catch (error) { safeError(res, error, "Tezgâh oluşturulamadı."); }
});

router.post("/:id/urun", auth, esnaf, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Tezgâh kimliği geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.id, aktif: true });
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    if (!ownsStall(stall, req.user)) return res.status(403).json({ success: false, message: "Bu tezgâhı düzenleme yetkiniz yok." });
    const { isim, kategori, birim = "kg", fiyat, fotograf = "" } = req.body || {};
    const price = Number(fiyat);
    if (!String(isim || "").trim() || !Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: "Ürün adı ve sıfırdan küçük olmayan geçerli fiyat zorunludur." });
    stall.urunler.push({ isim: String(isim).trim(), kategori, birim, guncelFiyat: price, fotograf, fiyatGecmisi: [{ fiyat: price, tarih: new Date() }] });
    await stall.save();
    res.status(201).json({ success: true, message: "Ürün eklendi.", data: stall.urunler[stall.urunler.length - 1] });
  } catch (error) { safeError(res, error, "Ürün eklenemedi."); }
});

router.put("/:tezgahId/urun/:urunId", auth, esnaf, async (req, res) => {
  try {
    if (!validId(req.params.tezgahId) || !validId(req.params.urunId)) return res.status(400).json({ success: false, message: "Kimlik bilgisi geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.tezgahId, aktif: true });
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    if (!ownsStall(stall, req.user)) return res.status(403).json({ success: false, message: "Bu tezgâhı düzenleme yetkiniz yok." });
    const product = stall.urunler.id(req.params.urunId);
    if (!product) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });
    const price = Number(req.body?.fiyat);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: "Geçerli bir fiyat girin." });
    product.guncelFiyat = price;
    product.fiyatGecmisi.push({ fiyat: price, tarih: new Date() });
    if (req.body?.fotograf !== undefined) product.fotograf = String(req.body.fotograf);
    await stall.save();
    res.json({ success: true, message: "Ürün fiyatı güncellendi.", data: product });
  } catch (error) { safeError(res, error, "Ürün fiyatı güncellenemedi."); }
});

router.post("/:id/yorum", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Tezgâh kimliği geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.id, aktif: true });
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    const yorum = String(req.body?.yorum || "").trim();
    const puan = Number(req.body?.puan);
    if (!yorum || yorum.length > 1000 || !Number.isInteger(puan) || puan < 1 || puan > 5) return res.status(400).json({ success: false, message: "1–5 arası puan ve en fazla 1000 karakterlik yorum girin." });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const todayCount = stall.yorumlar.filter(item => String(item.kullanici) === String(req.user.id) && new Date(item.tarih) >= start).length;
    if (todayCount >= 3) return res.status(429).json({ success: false, message: "Bir günde en fazla 3 yorum gönderebilirsiniz." });
    stall.yorumlar.push({ kullanici: req.user.id, kullaniciAdi: req.user.username, yorum, puan });
    stall.toplamYorum = stall.yorumlar.length;
    stall.ortalamaPuan = stall.yorumlar.reduce((sum, item) => sum + item.puan, 0) / stall.toplamYorum;
    await stall.save();
    res.status(201).json({ success: true, message: "Yorum eklendi.", toplamYorum: stall.toplamYorum, ortalamaPuan: stall.ortalamaPuan });
  } catch (error) { safeError(res, error, "Yorum eklenemedi."); }
});

router.delete("/:id", auth, esnaf, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Tezgâh kimliği geçersiz." });
    const stall = await Tezgah.findOne({ _id: req.params.id, aktif: true });
    if (!stall) return res.status(404).json({ success: false, message: "Tezgâh bulunamadı." });
    if (!ownsStall(stall, req.user)) return res.status(403).json({ success: false, message: "Bu tezgâhı silme yetkiniz yok." });
    stall.aktif = false;
    await stall.save();
    res.json({ success: true, message: "Tezgâh yayından kaldırıldı." });
  } catch (error) { safeError(res, error, "Tezgâh kaldırılamadı."); }
});

module.exports = router;
