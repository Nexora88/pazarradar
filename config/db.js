const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        console.log("MONGO_URI:", process.env.MONGO_URI);

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });

        console.log("✅ MongoDB bağlantısı başarılı");
    } catch (err) {
        console.error("❌ HATA ADI:", err.name);
        console.error("❌ HATA MESAJI:", err.message);
        console.error(err);
        process.exit(1);
    }
};

module.exports = connectDB;