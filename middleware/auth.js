const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function auth(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Giriş yapmanız gerekiyor." });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res
      .status(503)
      .json({ success: false, message: "Kimlik doğrulama yapılandırması hazır değil." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "street-bazaars",
      algorithms: ["HS256"],
    });
    const user = await User.findById(decoded.id).select("_id username role aktif");
    if (!user || !user.aktif) {
      return res
        .status(401)
        .json({ success: false, message: "Oturum geçersiz veya hesap devre dışı." });
    }
    req.user = { id: String(user._id), username: user.username, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Geçersiz oturum." });
  }
};
