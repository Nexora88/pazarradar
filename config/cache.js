const { createClient } = require("redis");

let client;

function initCache(logger) {
  if (!process.env.REDIS_URL) return;
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (error) =>
    logger.warn({
      message: "Redis önbelleği kullanılamıyor; istekler veritabanından devam edecek.",
      detail: error.message,
    }),
  );
  client
    .connect()
    .then(() => logger.info("Redis önbelleği hazır."))
    .catch((error) =>
      logger.warn({
        message: "Redis bağlantısı kurulamadı; önbellek devre dışı.",
        detail: error.message,
      }),
    );
}

function cacheResponse(ttlSeconds = 30) {
  return async function optionalCache(req, res, next) {
    if (req.method !== "GET" || !client?.isReady) return next();
    const key = "pazar-radar:" + req.originalUrl;
    try {
      const cached = await client.get(key);
      if (cached) {
        res.set("X-Cache", "HIT");
        return res.type("json").send(cached);
      }
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode < 400 && client?.isReady) {
          client.setEx(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
        }
        res.set("X-Cache", "MISS");
        return originalJson(body);
      };
      return next();
    } catch {
      return next();
    }
  };
}

module.exports = { initCache, cacheResponse };
