const express = require("express");
const { db, id } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { generateSignal } = require("../services/signal-engine.service");
const router = express.Router();

function safeUser(user) {
  return {
    id: user.id, name: user.name, phone: user.phone,
    isPhoneVerified: user.isPhoneVerified,
    signalCredits: user.signalCredits,
    usedSignals: user.usedSignals,
    nextPriceUsd: user.nextPriceUsd
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const signals = db.signals.filter((s) => s.userId === req.user.id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20);
    res.json({ signals });
  } catch (e) { next(e); }
});

router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user.isPhoneVerified) return res.status(403).json({ message: "Sinyal almak için telefon doğrulaması gerekli" });
    if (user.signalCredits <= 0) return res.status(402).json({ message: "Sinyal hakkınız yok. Ödeme yaparak yeni hak alabilirsiniz.", nextPriceUsd: user.nextPriceUsd });
    const signal = { id: id("signal"), userId: user.id, ...generateSignal(), status: "DELIVERED", createdAt: Date.now() };
    db.signals.push(signal);
    user.signalCredits -= 1;
    user.usedSignals += 1;
    res.json({ signal, user: safeUser(user) });
  } catch (e) { next(e); }
});
module.exports = router;
