const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI ortam değişkeni tanımlı değil.");

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.DB_TIMEOUT_MS) || 10000,
    autoIndex: process.env.NODE_ENV !== "production"
  });
  console.info("[database] MongoDB bağlantısı hazır.");
  return mongoose.connection;
}

module.exports = connectDB;
