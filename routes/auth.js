const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

const User = require("../models/User");
const auth = require("../middleware/auth");

// ======================
// VALIDATION
// ======================

const registerSchema = Joi.object({
    username: Joi.string().min(3).max(30).required(),

    email: Joi.string().email().required(),

    password: Joi.string().min(6).max(100).required(),

    adSoyad: Joi.string().allow("", null),

    telefon: Joi.string().allow("", null)
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// ======================
// KAYIT OL
// ======================

router.post("/register", async (req, res) => {

    try {

        const { error } = registerSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const {
            username,
            email,
            password,
            adSoyad,
            telefon
        } = req.body;

        const userExists = await User.findOne({
            $or: [
                { username },
                { email }
            ]
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "Bu kullanıcı zaten kayıtlı."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            adSoyad,
            telefon
        });

        res.status(201).json({
            success: true,
            message: "Kayıt başarılı."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// GİRİŞ YAP
// ======================

router.post("/login", async (req, res) => {

    try {

        const { error } = loginSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "E-posta veya şifre hatalı."
            });
        }

        if (!user.aktif) {
            return res.status(403).json({
                success: false,
                message: "Hesabınız pasif durumda."
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "E-posta veya şifre hatalı."
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,
            message: "Giriş başarılı.",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                adSoyad: user.adSoyad,
                profilFoto: user.profilFoto
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// PROFİL BİLGİLERİ
// ======================

router.get("/me", auth, async (req, res) => {

    try {

        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// ŞİFRE DEĞİŞTİR
// ======================

router.put("/change-password", auth, async (req, res) => {

    try {

        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Eski ve yeni şifre zorunludur."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Yeni şifre en az 6 karakter olmalıdır."
            });
        }

        const user = await User.findById(req.user.id);

        const match = await bcrypt.compare(oldPassword, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Eski şifre yanlış."
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);

        await user.save();

        res.json({
            success: true,
            message: "Şifre başarıyla değiştirildi."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================
// ÇIKIŞ
// ======================

router.post("/logout", auth, (req, res) => {

    res.json({
        success: true,
        message: "Çıkış başarılı. Token istemci tarafından silinmelidir."
    });

});

// ======================
// EXPORT
// ======================

module.exports = router;