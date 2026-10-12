const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
    try {

        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Giriş yapmanız gerekiyor."
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        next();

    } catch (err) {

        return res.status(401).json({
            success: false,
            message: "Geçersiz oturum."
        });

    }
};

module.exports = auth;