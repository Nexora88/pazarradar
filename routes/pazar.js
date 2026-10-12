const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Pazar = require("../models/Pazar");
const User = require("../models/User");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const { cacheResponse } = require("../config/cache");

const validId = (id) => mongoose.isValidObjectId(id);
const safeError = (res, error) => {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Gönderilen bilgiler geçersiz." });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: "Bu kayıt zaten mevcut." });
  }
  console.error("[pazar]", error?.message || error);
  return res.status(500).json({ success: false, message: "İşlem sırasında sunucu hatası oluştu." });
};
const escapeRegex = (value) =>
  String(value)
    .slice(0, 80)
    .replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
const allowedFields = [
  "ad",
  "il",
  "ilce",
  "mahalle",
  "adres",
  "gunler",
  "saatler",
  "konum",
  "etiketler",
  "fotograflar",
  "aciklama",
  "ortalamaPuan",
  "toplamYorum",
  "fiyatEndeksi",
  "aktif",
];
const pick = (body, fields = allowedFields) =>
  Object.fromEntries(
    fields.filter((key) => body?.[key] !== undefined).map((key) => [key, body[key]]),
  );

router.get("/", cacheResponse(30), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { aktif: true };
    if (req.query.ilce) query.ilce = String(req.query.ilce).slice(0, 80);
    if (req.query.bugun === "true") {
      query.gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][
        new Date().getDay()
      ];
    } else if (req.query.gun) {
      query.gunler = String(req.query.gun).slice(0, 20);
    }
    if (req.query.etiket) query.etiketler = { $in: [String(req.query.etiket).slice(0, 40)] };
    if (req.query.search) {
      const search = escapeRegex(req.query.search);
      query.$or = [
        { ad: { $regex: search, $options: "i" } },
        { ilce: { $regex: search, $options: "i" } },
        { mahalle: { $regex: search, $options: "i" } },
        { adres: { $regex: search, $options: "i" } },
      ];
    }
    const [total, data] = await Promise.all([
      Pazar.countDocuments(query),
      Pazar.find(query)
        .sort({ ad: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    res.json({ success: true, total, page, limit, totalPages: Math.ceil(total / limit), data });
  } catch (error) {
    safeError(res, error);
  }
});

router.get("/favoriler/listem", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({ path: "favoriler", match: { aktif: true } })
      .select("favoriler");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    res.json({ success: true, data: user.favoriler || [] });
  } catch (error) {
    safeError(res, error);
  }
});

router.get("/populer/list", cacheResponse(60), async (req, res) => {
  try {
    const data = await Pazar.find({ aktif: true })
      .sort({ ortalamaPuan: -1, toplamYorum: -1, ad: 1 })
      .limit(10)
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    safeError(res, error);
  }
});

router.get("/yakin", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(50000, Math.max(100, Number(req.query.radius) || 5000));
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Geçerli enlem ve boylam gereklidir." });
    }
    const data = await Pazar.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "mesafeMetre",
          maxDistance: radius,
          spherical: true,
          query: { aktif: true },
        },
      },
      { $limit: 50 },
    ]);
    res.json({ success: true, count: data.length, radiusMetre: radius, data });
  } catch (error) {
    safeError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Pazar kimliği geçersiz." });
    }
    const data = await Pazar.findOne({ _id: req.params.id, aktif: true }).lean();
    if (!data) return res.status(404).json({ success: false, message: "Pazar bulunamadı." });
    res.json({ success: true, data });
  } catch (error) {
    safeError(res, error);
  }
});

router.post("/", auth, admin, async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.ad || !data.ilce || !data.adres) {
      return res
        .status(400)
        .json({ success: false, message: "Pazar adı, ilçe ve adres zorunludur." });
    }
    const market = await Pazar.create(data);
    res.status(201).json({ success: true, message: "Pazar eklendi.", data: market });
  } catch (error) {
    safeError(res, error);
  }
});

router.put("/:id", auth, admin, async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Pazar kimliği geçersiz." });
    }
    const data = pick(req.body);
    for (const field of ["ortalamaPuan", "toplamYorum", "fiyatEndeksi"]) delete data[field];
    const market = await Pazar.findById(req.params.id);
    if (!market) return res.status(404).json({ success: false, message: "Pazar bulunamadı." });
    Object.assign(market, data);
    await market.save();
    res.json({ success: true, message: "Pazar güncellendi.", data: market });
  } catch (error) {
    safeError(res, error);
  }
});

router.delete("/:id", auth, admin, async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Pazar kimliği geçersiz." });
    }
    const market = await Pazar.findByIdAndUpdate(req.params.id, { aktif: false }, { new: true });
    if (!market) return res.status(404).json({ success: false, message: "Pazar bulunamadı." });
    res.json({ success: true, message: "Pazar yayından kaldırıldı." });
  } catch (error) {
    safeError(res, error);
  }
});

router.post("/:id/favori", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Pazar kimliği geçersiz." });
    }
    const market = await Pazar.findOne({ _id: req.params.id, aktif: true }).select("_id");
    if (!market) return res.status(404).json({ success: false, message: "Pazar bulunamadı." });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    const index = user.favoriler.findIndex((item) => String(item) === req.params.id);
    if (index === -1) user.favoriler.push(market._id);
    else user.favoriler.splice(index, 1);
    await user.save();
    res.json({
      success: true,
      message: index === -1 ? "Pazar favorilere eklendi." : "Pazar favorilerden çıkarıldı.",
      favoriler: user.favoriler,
    });
  } catch (error) {
    safeError(res, error);
  }
});

module.exports = router;
