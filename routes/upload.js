const express = require("express");
const router = express.Router();

const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;

const auth = require("../middleware/auth");

// ======================
// CLOUDINARY
// ======================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ======================
// MULTER
// ======================

const storage = multer.memoryStorage();

const upload = multer({

    storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter(req, file, cb) {

        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowed.includes(file.mimetype)) {

            return cb(new Error("Sadece JPG, PNG ve WEBP yükleyebilirsiniz."));

        }

        cb(null, true);

    }

});

// ======================
// CLOUDINARY UPLOAD
// ======================

function uploadToCloudinary(buffer, folder) {

    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(

            {
                folder
            },

            (error, result) => {

                if (error) return reject(error);

                resolve(result);

            }

        );

        streamifier.createReadStream(buffer).pipe(stream);

    });

}

// ======================
// PROFİL FOTOĞRAFI
// ======================

router.post(
    "/profile",
    auth,
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "Fotoğraf bulunamadı."
                });

            }

            const result = await uploadToCloudinary(
                req.file.buffer,
                "istanbul-pazar/profil"
            );

            res.json({

                success: true,

                image: result.secure_url

            });

        } catch (err) {

            res.status(500).json({

                success: false,

                message: err.message

            });

        }

    }
);

// ======================
// TEZGAH FOTOĞRAFI
// ======================

router.post(
    "/tezgah",
    auth,
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "Fotoğraf bulunamadı."
                });

            }

            const result = await uploadToCloudinary(
                req.file.buffer,
                "istanbul-pazar/tezgah"
            );

            res.json({

                success: true,

                image: result.secure_url

            });

        } catch (err) {

            res.status(500).json({

                success: false,

                message: err.message

            });

        }

    }
);

// ======================
// ÜRÜN FOTOĞRAFI
// ======================

router.post(
    "/urun",
    auth,
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message: "Fotoğraf bulunamadı."
                });

            }

            const result = await uploadToCloudinary(
                req.file.buffer,
                "istanbul-pazar/urun"
            );

            res.json({

                success: true,

                image: result.secure_url

            });

        } catch (err) {

            res.status(500).json({

                success: false,

                message: err.message

            });

        }

    }
);

// ======================
// EXPORT
// ======================

module.exports = router;