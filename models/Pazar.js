const mongoose = require("mongoose");

const PazarSchema = new mongoose.Schema({
  ad: { type: String, required: true, trim: true, maxlength: 140 },
  il: { type: String, default: "İstanbul", trim: true, maxlength: 80 },
  ilce: { type: String, required: true, trim: true, maxlength: 80, index: true },
  mahalle: { type: String, default: "", trim: true, maxlength: 120 },
  adres: { type: String, required: true, trim: true, maxlength: 300 },
  gunler: { type: [{ type: String, enum: ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"] }], default: [] },
  saatler: {
    acilis: { type: String, default: "08:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    kapanis: { type: String, default: "20:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ }
  },
  konum: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
  fotograflar: { type: [{ type: String, maxlength: 2048 }], default: [] },
  aciklama: { type: String, default: "", trim: true, maxlength: 3000 },
  ortalamaPuan: { type: Number, default: 0, min: 0, max: 5 },
  toplamYorum: { type: Number, default: 0, min: 0 },
  fiyatEndeksi: { type: Number, default: 50, min: 0, max: 100 },
  aktif: { type: Boolean, default: true, index: true }
}, { timestamps: true });

PazarSchema.index({ ad: "text", ilce: "text", mahalle: "text", adres: "text" });
module.exports = mongoose.model("Pazar", PazarSchema);
