// ======================================================
// İstanbul Pazar
// Server.js
// Bölüm 1A
// Temel Altyapı + Güvenlik + MongoDB
// ======================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const connectDB = require('./config/db');
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const pazarRoutes = require("./routes/pazar");
const tezgahRoutes = require('./routes/tezgah');
const uploadRoutes = require('./routes/upload');


const app = express();
connectDB();
const server = http.createServer(app);

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ======================================================
// LOGGER
// ======================================================

const logger = winston.createLogger({

    level: "info",

    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
            return `[${timestamp}] ${level.toUpperCase()} : ${message}`;
        })
    ),

    transports: [

        new winston.transports.Console(),

        new winston.transports.File({
            filename: "logs/error.log",
            level: "error"
        }),

        new winston.transports.File({
            filename: "logs/combined.log"
        })

    ]

});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(helmet());

app.use(compression());

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));


app.use(morgan("dev"));

app.use(express.static("public"));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin."
    }
});

app.use(apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/pazar", pazarRoutes);
app.use("/api/tezgah", tezgahRoutes);
app.use("/api/upload", uploadRoutes);

// ======================================================
// ENV KONTROL
// ======================================================

if (!process.env.JWT_SECRET) {

    logger.error("JWT_SECRET bulunamadı!");

    process.exit(1);

}

if (!process.env.MONGO_URI) {

    logger.warn("MONGO_URI bulunamadı.");

    logger.warn("Local MongoDB kullanılacak.");

}

// ======================================================
// MONGODB
// ======================================================


app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "İstanbul Pazar API çalışıyor 🚀"
    });
});

// ====================== ANA SAYFA ======================
app.get('/', (req, res) => {
  res.json({
    success: true,
    app: "İstanbul Pazar",
    version: "1.0.0",
    status: "API Çalışıyor"
  });
});

app.use((err, req, res, next) => {
    logger.error(err.stack);

    res.status(500).json({
        success: false,
        message: "Sunucu hatası oluştu."
    });
});
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    logger.info(`🚀 Server ${PORT} portunda çalışıyor.`);
});