const express = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const auth = require("../middleware/auth");
const esnaf = require("../middleware/esnaf");
const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      const error = new Error("Yalnızca JPG, PNG veya WEBP görseller yüklenebilir.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  }
});
const configured = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const uploadImage = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image", transformation: [{ width: 1800, height: 1800, crop: "limit" }] }, (error, result) => error ? reject(error) : resolve(result));
  streamifier.createReadStream(buffer).pipe(stream);
});
const receiveImage = upload.single("image");
const handleUpload = handler => (req, res, next) => receiveImage(req, res, error => {
  if (error) return res.status(error.status || 400).json({ success: false, message: error.message || "Görsel yüklenemedi." });
  Promise.resolve(handler(req, res, next)).catch(error => {
    console.error("[upload]", error?.message || error);
    res.status(502).json({ success: false, message: "Görsel yüklenemedi. Depolama ayarlarını kontrol edin." });
  });
});

router.post("/profile", auth, handleUpload(async (req, res) => {
  if (!configured()) return res.status(503).json({ success: false, message: "Görsel depolama henüz yapılandırılmamış." });
  if (!req.file) return res.status(400).json({ success: false, message: "Yüklenecek bir görsel seçin." });
  const result = await uploadImage(req.file.buffer, "pazar-radar/profil");
  await User.findByIdAndUpdate(req.user.id, { profilFoto: result.secure_url });
  res.json({ success: true, image: result.secure_url });
}));
router.post("/tezgah", auth, esnaf, handleUpload(async (req, res) => {
  if (!configured()) return res.status(503).json({ success: false, message: "Görsel depolama henüz yapılandırılmamış." });
  if (!req.file) return res.status(400).json({ success: false, message: "Yüklenecek bir görsel seçin." });
  const result = await uploadImage(req.file.buffer, "pazar-radar/tezgah");
  res.json({ success: true, image: result.secure_url });
}));
router.post("/urun", auth, esnaf, handleUpload(async (req, res) => {
  if (!configured()) return res.status(503).json({ success: false, message: "Görsel depolama henüz yapılandırılmamış." });
  if (!req.file) return res.status(400).json({ success: false, message: "Yüklenecek bir görsel seçin." });
  const result = await uploadImage(req.file.buffer, "pazar-radar/urun");
  res.json({ success: true, image: result.secure_url });
}));
module.exports = router;
