const mongoose = require("mongoose");

const PazarSchema = new mongoose.Schema(
  {
    ad: { type: String, required: true, trim: true, maxlength: 140 },
    il: { type: String, enum: ["İstanbul"], default: "İstanbul", trim: true, maxlength: 80 },
    ilce: { type: String, required: true, trim: true, maxlength: 80, index: true },
    sourceKey: { type: String, trim: true, unique: true, sparse: true },
    tur: { type: String, default: "Semt Pazarı", trim: true, maxlength: 80 },
    kaynak: { type: String, default: "", trim: true, maxlength: 160 },
    kaynakUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    kaynakGuncelleme: { type: Date },
    koordinatDurumu: {
      type: String,
      enum: ["kaynakta-yok", "dogrulandi"],
      default: "kaynakta-yok",
    },
    mahalle: { type: String, default: "", trim: true, maxlength: 120 },
    adres: { type: String, required: true, trim: true, maxlength: 300 },
    gunler: {
      type: [
        {
          type: String,
          enum: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
        },
      ],
      default: [],
    },
    saatler: {
      acilis: { type: String, default: "08:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      kapanis: { type: String, default: "20:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
    konum: { lat: { type: Number, min: -90, max: 90 }, lng: { type: Number, min: -180, max: 180 } },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: (value) => Array.isArray(value) && value.length === 2,
      },
    },
    etiketler: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    fotograflar: { type: [{ type: String, maxlength: 2048 }], default: [] },
    aciklama: { type: String, default: "", trim: true, maxlength: 3000 },
    ortalamaPuan: { type: Number, default: 0, min: 0, max: 5 },
    toplamYorum: { type: Number, default: 0, min: 0 },
    fiyatEndeksi: { type: Number, default: 50, min: 0, max: 100 },
    aktif: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

PazarSchema.index({ ad: "text", ilce: "text", mahalle: "text", adres: "text" });
PazarSchema.index({ location: "2dsphere" });
PazarSchema.index({ ilce: 1, gunler: 1, aktif: 1 });
PazarSchema.index({ il: 1, ilce: 1, aktif: 1 });

PazarSchema.pre("validate", function syncGeoJSON() {
  const lat = this.konum?.lat;
  const lng = this.konum?.lng;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    this.location = { type: "Point", coordinates: [lng, lat] };
  }
});

module.exports = mongoose.model("Pazar", PazarSchema);
