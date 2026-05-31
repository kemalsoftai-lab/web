const jwt = require("jsonwebtoken");
const { db } = require("../db");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Oturum gerekli" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "demo_secret");
    const user = db.users.find((item) => item.id === payload.userId);
    if (!user) return res.status(401).json({ message: "Kullanıcı bulunamadı" });

    req.user = {
      id: user.id, name: user.name, phone: user.phone,
      isPhoneVerified: user.isPhoneVerified,
      signalCredits: user.signalCredits,
      usedSignals: user.usedSignals,
      nextPriceUsd: user.nextPriceUsd
    };
    next();
  } catch {
    return res.status(401).json({ message: "Geçersiz veya süresi dolmuş oturum" });
  }
}
module.exports = { requireAuth };
