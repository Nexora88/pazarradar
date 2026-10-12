const mongoose = require("mongoose");

const PazarSchema = new mongoose.Schema({

    ad: {
        type: String,
        required: true,
        trim: true
    },

    il: {
        type: String,
        default: "İstanbul"
    },

    ilce: {
        type: String,
        required: true
    },

    mahalle: {
        type: String,
        default: ""
    },

    adres: {
        type: String,
        required: true
    },

    gunler: [{
        type: String
    }],

    saatler: {
        acilis: {
            type: String,
            default: "08:00"
        },
        kapanis: {
            type: String,
            default: "20:00"
        }
    },

    konum: {
        lat: Number,
        lng: Number
    },

    fotograflar: [{
        type: String
    }],

    aciklama: {
        type: String,
        default: ""
    },

    ortalamaPuan: {
        type: Number,
        default: 0
    },

    toplamYorum: {
        type: Number,
        default: 0
    },

    fiyatEndeksi: {
        type: Number,
        default: 50
    },

    aktif: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Pazar", PazarSchema);