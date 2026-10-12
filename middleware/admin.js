const admin = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Yetkisiz erişim."
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Bu işlem için admin yetkisi gerekiyor."
        });
    }

    next();

};

module.exports = admin;