const mongoose = require("mongoose");

const FiyatSchema = new mongoose.Schema({
  fiyat: { type: Number, required: true, min: 0 },
  tarih: { type: Date, default: Date.now }
}, { _id: false });

const UrunSchema = new mongoose.Schema({
  isim: { type: String, required: true, trim: true, maxlength: 100 },
  kategori: { type: String, default: "Diğer", trim: true, maxlength: 60 },
  birim: { type: String, default: "kg", trim: true, maxlength: 30 },
  guncelFiyat: { type: Number, default: 0, min: 0 },
  fiyatGecmisi: { type: [FiyatSchema], default: [] },
  fotograf: { type: String, default: "", maxlength: 2048 }
}, { timestamps: true });

const YorumSchema = new mongoose.Schema({
  kullanici: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  kullaniciAdi: { type: String, default: "", maxlength: 30 },
  puan: { type: Number, required: true, min: 1, max: 5 },
  yorum: { type: String, required: true, trim: true, maxlength: 1000 },
  fotograflar: { type: [String], default: [] },
  tarih: { type: Date, default: Date.now }
}, { _id: false });

const TezgahSchema = new mongoose.Schema({
  pazar: { type: mongoose.Schema.Types.ObjectId, ref: "Pazar", required: true, index: true },
  esnaf: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tezgahAdi: { type: String, required: true, trim: true, maxlength: 120 },
  aciklama: { type: String, default: "", trim: true, maxlength: 2000 },
  urunler: { type: [UrunSchema], default: [] },
  yorumlar: { type: [YorumSchema], default: [] },
  ortalamaPuan: { type: Number, default: 0, min: 0, max: 5 },
  toplamYorum: { type: Number, default: 0, min: 0 },
  takipciSayisi: { type: Number, default: 0, min: 0 },
  aktif: { type: Boolean, default: true }
}, { timestamps: true });

TezgahSchema.index({ tezgahAdi: "text", aciklama: "text" });
module.exports = mongoose.model("Tezgah", TezgahSchema);
