module.exports = function denetci(req, res, next) {
  if (!req.user || !["denetci", "admin"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ success: false, message: "Bu işlem için pazar denetçisi yetkisi gerekir." });
  }
  next();
};
