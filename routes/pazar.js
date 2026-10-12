const express = require("express");
const router = express.Router();

const Pazar = require("../models/Pazar");
const User = require("../models/User");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// ======================
// TÜM PAZARLARI LİSTELE
// ======================

router.get("/", async (req, res) => {

    try {

        const {
            ilce,
            gun,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const query = {};

        if (ilce) {
            query.ilce = ilce;
        }

        if (gun) {
            query.gunler = gun;
        }

        if (search) {
            query.ad = {
                $regex: search,
                $options: "i"
            };
        }

        const total = await Pazar.countDocuments(query);

        const pazarlar = await Pazar.find(query)
            .sort({ ad: 1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit));

        res.json({
            success: true,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            data: pazarlar
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// TEK PAZAR
// ======================

router.get("/:id", async (req, res) => {

    try {

        const pazar = await Pazar.findById(req.params.id);

        if (!pazar) {
            return res.status(404).json({
                success: false,
                message: "Pazar bulunamadı."
            });
        }

        res.json({
            success: true,
            data: pazar
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// PAZAR EKLE (ADMIN)
// ======================

router.post("/", auth, admin, async (req, res) => {

    try {

        const pazar = await Pazar.create(req.body);

        res.status(201).json({
            success: true,
            message: "Pazar başarıyla eklendi.",
            data: pazar
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// PAZAR GÜNCELLE (ADMIN)
// ======================

router.put("/:id", auth, admin, async (req, res) => {

    try {

        const pazar = await Pazar.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!pazar) {
            return res.status(404).json({
                success: false,
                message: "Pazar bulunamadı."
            });
        }

        res.json({
            success: true,
            message: "Pazar güncellendi.",
            data: pazar
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// PAZAR SİL (ADMIN)
// ======================

router.delete("/:id", auth, admin, async (req, res) => {

    try {

        const pazar = await Pazar.findByIdAndDelete(req.params.id);

        if (!pazar) {
            return res.status(404).json({
                success: false,
                message: "Pazar bulunamadı."
            });
        }

        res.json({
            success: true,
            message: "Pazar silindi."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// FAVORİLERE EKLE / ÇIKAR
// ======================

router.post("/:id/favori", auth, async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }

        const index = user.favoriler.findIndex(
            item => item.toString() === req.params.id
        );

        let message = "";

        if (index === -1) {

            user.favoriler.push(req.params.id);

            message = "Pazar favorilere eklendi.";

        } else {

            user.favoriler.splice(index, 1);

            message = "Pazar favorilerden kaldırıldı.";

        }

        await user.save();

        res.json({
            success: true,
            message,
            favoriler: user.favoriler
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// FAVORİ PAZARLAR
// ======================

router.get("/favoriler/listem", auth, async (req, res) => {

    try {

        const user = await User.findById(req.user.id)
            .populate("favoriler");

        res.json({
            success: true,
            data: user.favoriler
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// POPÜLER PAZARLAR
// ======================

router.get("/populer/list", async (req, res) => {

    try {

        const pazarlar = await Pazar.find()
            .sort({ puan: -1, takipciSayisi: -1 })
            .limit(10);

        res.json({
            success: true,
            data: pazarlar
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