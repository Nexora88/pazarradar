// middleware/esnaf.js

module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Giriş yapmanız gerekiyor.",
    });
  }

  if (req.user.role !== "esnaf" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bu işlem için esnaf yetkisi gerekiyor.",
    });
  }

  next();
};
