const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const router = express.Router();

const registerSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[\p{L}\p{N}_.-]+$/u)
    .required(),
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(8).max(100).required(),
  adSoyad: Joi.string().trim().max(100).allow(""),
  telefon: Joi.string().trim().max(30).allow(""),
});
const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(1).max(100).required(),
});
const fail = (res, error) => {
  if (error?.code === 11000) {
    return res
      .status(409)
      .json({ success: false, message: "Bu e-posta veya kullanıcı adı zaten kayıtlı." });
  }
  console.error("[auth]", error?.message || error);
  return res.status(500).json({ success: false, message: "İşlem sırasında sunucu hatası oluştu." });
};
const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  adSoyad: user.adSoyad,
  profilFoto: user.profilFoto,
  rozetler: user.rozetler || [],
  dogruFiyatOyuSayisi: user.dogruFiyatOyuSayisi || 0,
});

router.post("/register", async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  try {
    const username = value.username.trim();
    const email = value.email.toLowerCase().trim();
    const exists = await User.findOne({ $or: [{ username }, { email }] }).select("_id");
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Bu e-posta veya kullanıcı adı zaten kayıtlı." });
    }
    const user = await User.create({
      username,
      email,
      password: await bcrypt.hash(value.password, 12),
      adSoyad: value.adSoyad || "",
      telefon: value.telefon || "",
    });
    res.status(201).json({
      success: true,
      message: "Hesap oluşturuldu. Şimdi giriş yapabilirsiniz.",
      user: publicUser(user),
    });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/login", async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  try {
    const user = await User.findOne({ email: value.email.toLowerCase().trim() });
    if (!user || !user.aktif || !(await bcrypt.compare(value.password, user.password))) {
      return res.status(401).json({ success: false, message: "E-posta veya şifre hatalı." });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res
        .status(503)
        .json({ success: false, message: "Kimlik doğrulama yapılandırması hazır değil." });
    }
    const token = jwt.sign(
      { id: String(user._id), username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d", issuer: "street-bazaars" },
    );
    res.json({ success: true, message: "Giriş başarılı.", token, user: publicUser(user) });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    res.json({ success: true, user });
  } catch (error) {
    fail(res, error);
  }
});

router.put("/change-password", auth, async (req, res) => {
  const schema = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(100).required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    if (!(await bcrypt.compare(value.oldPassword, user.password))) {
      return res.status(401).json({ success: false, message: "Mevcut şifre hatalı." });
    }
    user.password = await bcrypt.hash(value.newPassword, 12);
    await user.save();
    res.json({ success: true, message: "Şifreniz güncellendi." });
  } catch (error) {
    fail(res, error);
  }
});

router.patch("/users/:id/role", auth, admin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Kullanıcı kimliği geçersiz." });
  }
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({
      success: false,
      message: "Kendi yönetici rolünüzü bu uç noktadan değiştiremezsiniz.",
    });
  }
  const role = req.body?.role;
  if (!["user", "esnaf", "denetci", "admin"].includes(role)) {
    return res
      .status(400)
      .json({ success: false, message: "Geçerli rol: user, esnaf, denetci veya admin." });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    user.role = role;
    await user.save();
    res.json({ success: true, message: "Kullanıcı rolü güncellendi.", user: publicUser(user) });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/logout", auth, (req, res) =>
  res.json({
    success: true,
    message: "Çıkış isteği alındı. Oturum belirteci istemciden silinmelidir.",
  }),
);
module.exports = router;
