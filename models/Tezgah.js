const mongoose = require("mongoose");

const FiyatSchema = new mongoose.Schema({
    fiyat: {
        type: Number,
        required: true
    },
    tarih: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const UrunSchema = new mongoose.Schema({
    isim: {
        type: String,
        required: true
    },

    kategori: {
        type: String,
        default: "Diğer"
    },

    birim: {
        type: String,
        default: "kg"
    },

    guncelFiyat: {
        type: Number,
        default: 0
    },

    fiyatGecmisi: [FiyatSchema],

    fotograf: {
        type: String,
        default: ""
    }
}, { _id: false });

const YorumSchema = new mongoose.Schema({
    kullanici: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    kullaniciAdi: String,

    puan: {
        type: Number,
        min: 1,
        max: 5
    },

    yorum: String,

    fotograflar: [{
        type: String
    }],

    tarih: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const TezgahSchema = new mongoose.Schema({

    pazar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pazar",
        required: true
    },

    esnaf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    tezgahAdi: {
        type: String,
        required: true
    },

    aciklama: {
        type: String,
        default: ""
    },

    urunler: [UrunSchema],

    yorumlar: [YorumSchema],

    ortalamaPuan: {
        type: Number,
        default: 0
    },

    toplamYorum: {
        type: Number,
        default: 0
    },

    takipciSayisi: {
        type: Number,
        default: 0
    },

    aktif: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Tezgah", TezgahSchema);