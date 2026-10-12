const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "esnaf", "denetci", "admin"],
      default: "user",
    },

    adSoyad: {
      type: String,
      default: "",
    },

    telefon: {
      type: String,
      default: "",
    },

    profilFoto: {
      type: String,
      default: "",
    },

    favoriler: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pazar",
      },
    ],

    rozetler: {
      type: [{ type: String, enum: ["Pazar Gurmesi", "Tasarruf Lideri", "Fiyat Doğrulayıcı"] }],
      default: [],
    },

    dogruFiyatOyuSayisi: { type: Number, default: 0, min: 0 },

    aktif: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
