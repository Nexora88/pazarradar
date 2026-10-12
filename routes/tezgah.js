const express = require("express");
const router = express.Router();

const Tezgah = require("../models/Tezgah");
const Pazar = require("../models/Pazar");

const auth = require("../middleware/auth");
const esnaf = require("../middleware/esnaf");
const admin = require("../middleware/admin");

// ======================
// TÜM TEZGAHLARI LİSTELE
// ======================

router.get("/", async (req, res) => {

    try {

        const {
            pazar,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const query = {};

        if (pazar) {
            query.pazarId = pazar;
        }

        if (search) {
            query.tezgahAdi = {
                $regex: search,
                $options: "i"
            };
        }

        const total = await Tezgah.countDocuments(query);

        const tezgahlar = await Tezgah.find(query)
            .populate("pazarId", "ad ilce")
            .sort({ createdAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit));

        res.json({
            success: true,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            data: tezgahlar
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// TEK TEZGAH
// ======================

router.get("/:id", async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.id)
            .populate("pazarId", "ad ilce adres");

        if (!tezgah) {
            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });
        }

        res.json({
            success: true,
            data: tezgah
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// TEZGAH EKLE (ESNAF)
// ======================

router.post("/", auth, esnaf, async (req, res) => {

    try {

        const tezgah = await Tezgah.create({
            ...req.body,
            sahip: req.user.id
        });

        res.status(201).json({
            success: true,
            message: "Tezgah oluşturuldu.",
            data: tezgah
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// ÜRÜN EKLE (ESNAF)
// ======================

router.post("/:id/urun", auth, esnaf, async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.id);

        if (!tezgah) {
            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });
        }

        const { isim, birim, fiyat } = req.body;

        tezgah.urunler.push({

            isim,

            birim,

            ortalamaFiyat: fiyat,

            fiyatlar: [{
                fiyat,
                tarih: new Date()
            }]

        });

        await tezgah.save();

        res.status(201).json({

            success: true,
            message: "Ürün eklendi.",

            data: tezgah

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ======================
// FİYAT GÜNCELLE
// ======================

router.put("/:tezgahId/urun/:urunId", auth, esnaf, async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.tezgahId);

        if (!tezgah) {
            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });
        }

        const urun = tezgah.urunler.id(req.params.urunId);

        if (!urun) {
            return res.status(404).json({
                success: false,
                message: "Ürün bulunamadı."
            });
        }

        urun.ortalamaFiyat = req.body.fiyat;

        urun.fiyatlar.push({

            fiyat: req.body.fiyat,

            tarih: new Date()

        });

        await tezgah.save();

        res.json({

            success: true,

            message: "Fiyat güncellendi.",

            data: urun

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ======================
// ÜRÜN FİYAT GEÇMİŞİ
// ======================

router.get("/:tezgahId/urun/:urunId/fiyatlar", async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.tezgahId);

        const urun = tezgah.urunler.id(req.params.urunId);

        if (!urun) {

            return res.status(404).json({

                success: false,

                message: "Ürün bulunamadı."

            });

        }

        res.json({

            success: true,

            fiyatGecmisi: urun.fiyatlar

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ======================
// YORUM EKLE
// ======================

router.post("/:id/yorum", auth, async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.id);

        if (!tezgah) {
            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });
        }

        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);

        const bugunkuYorumlar = tezgah.yorumlar.filter(yorum => {

            const tarih = new Date(yorum.createdAt);
            tarih.setHours(0, 0, 0, 0);

            return (
                yorum.userId.toString() === req.user.id &&
                tarih.getTime() === bugun.getTime()
            );

        });

        if (bugunkuYorumlar.length >= 3) {

            return res.status(429).json({
                success: false,
                message: "Bugün en fazla 3 yorum yapabilirsiniz."
            });

        }

        tezgah.yorumlar.push({

            userId: req.user.id,
            kullanici: req.user.username,
            yorum: req.body.yorum,
            puan: req.body.puan,
            foto: req.body.foto || ""

        });

        const toplam = tezgah.yorumlar.reduce((t, y) => t + y.puan, 0);

        tezgah.ortalamaPuan = toplam / tezgah.yorumlar.length;

        await tezgah.save();

        res.json({

            success: true,
            message: "Yorum eklendi.",
            ortalamaPuan: tezgah.ortalamaPuan

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================
// YORUMLARI GETİR
// ======================

router.get("/:id/yorumlar", async (req, res) => {

    try {

        const tezgah = await Tezgah.findById(req.params.id);

        if (!tezgah) {

            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });

        }

        res.json({

            success: true,
            toplam: tezgah.yorumlar.length,
            ortalamaPuan: tezgah.ortalamaPuan,
            yorumlar: tezgah.yorumlar

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================
// TEZGAH SİL
// ======================

router.delete("/:id", auth, esnaf, async (req, res) => {

    try {

        const tezgah = await Tezgah.findByIdAndDelete(req.params.id);

        if (!tezgah) {

            return res.status(404).json({
                success: false,
                message: "Tezgah bulunamadı."
            });

        }

        res.json({

            success: true,
            message: "Tezgah silindi."

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================
// EXPORT
// ======================

module.exports = router;