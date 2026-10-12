require("dotenv").config();

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { initCache } = require("./config/cache");
const authRoutes = require("./routes/auth");
const pazarRoutes = require("./routes/pazar");
const tezgahRoutes = require("./routes/tezgah");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const logDir = path.join(__dirname, "logs");
fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Çok fazla giriş/kayıt denemesi. Biraz sonra tekrar deneyin.",
  },
});

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'self'", "https://www.openstreetmap.org"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(
  cors((req, callback) => {
    const origin = req.get("Origin");
    const ownOrigin = req.get("host") ? `${req.protocol}://${req.get("host")}` : "";
    const allowed =
      !origin ||
      origin === ownOrigin ||
      allowedOrigins.includes(origin) ||
      (!allowedOrigins.length && process.env.NODE_ENV !== "production");
    callback(null, {
      origin: allowed,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    });
  }),
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT) || 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.",
  },
});

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const database =
    { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }[dbState] ||
    "unknown";
  const ready = dbState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ok" : "degraded",
    app: "Pazar Radar",
    database,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", apiLimiter);
app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Veritabanı bağlantısı hazır değil. Lütfen biraz sonra tekrar deneyin.",
    });
  }
  next();
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/pazar", pazarRoutes);
app.use("/api/tezgah", tezgahRoutes);
app.use("/api/upload", uploadRoutes);
app.use(
  express.static(publicDir, {
    extensions: ["html"],
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }),
);

app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.use("/api", (req, res) =>
  res.status(404).json({ success: false, message: "API uç noktası bulunamadı." }),
);
app.use((req, res) => res.status(404).sendFile(path.join(publicDir, "index.html")));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "İstek boyutu sınırı aşıldı." });
  }
  if (error?.message === "Bu kaynaktan erişime izin verilmiyor.") {
    return res.status(403).json({ success: false, message: error.message });
  }
  logger.error({ message: error.message, path: req.path, method: req.method });
  res.status(500).json({ success: false, message: "Sunucuda beklenmeyen bir hata oluştu." });
});

let retryTimer;
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.error("JWT_SECRET tanımlı olmalı ve en az 32 karakter içermelidir.");
    process.exitCode = 1;
    return;
  }
  initCache(logger);
  server.listen(port, () =>
    logger.info({
      message: "Pazar Radar web sunucusu hazır.",
      port,
      environment: process.env.NODE_ENV || "development",
    }),
  );
  try {
    await connectDB();
  } catch (error) {
    logger.error({
      message:
        "MongoDB bağlantısı kurulamadı. Arayüz açık kalacak; API verileri için MONGO_URI ve ağ erişimini kontrol edin.",
      detail: error.message,
    });
    retryTimer = setInterval(async () => {
      if (mongoose.connection.readyState === 1) return clearInterval(retryTimer);
      try {
        await connectDB();
        clearInterval(retryTimer);
      } catch (retryError) {
        logger.warn({
          message: "MongoDB yeniden bağlantısı başarısız; yeniden denenecek.",
          detail: retryError.message,
        });
      }
    }, 30000);
    retryTimer.unref();
  }
}

server.on("error", (error) => {
  logger.error({ message: "HTTP sunucusu başlatılamadı.", detail: error.message });
  process.exitCode = 1;
});
process.on("unhandledRejection", (error) =>
  logger.error({ message: "İşlenmemiş promise hatası.", detail: error?.message || String(error) }),
);
async function shutdown() {
  if (retryTimer) clearInterval(retryTimer);
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

if (require.main === module) start();
module.exports = { app, server, start };
