const express = require("express");
const { db, id } = require("../db");
const { requireAuth } = require("../middleware/auth");
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

router.post("/create", requireAuth, async (req, res, next) => {
  try {
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user.isPhoneVerified) return res.status(403).json({ message: "Ödeme için hesap doğrulaması gerekli" });
    const payment = { id: id("payment"), userId: user.id, amountUsd: user.nextPriceUsd, provider: "manual", status: "PENDING", createdAt: Date.now() };
    db.payments.push(payment);
    res.status(201).json({ message: "Ödeme kaydı oluşturuldu", paymentId: payment.id, amountUsd: payment.amountUsd });
  } catch (e) { next(e); }
});

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const user = db.users.find((u) => u.id === req.user.id);
    const payment = db.payments.find((p) => p.id === req.body.paymentId && p.userId === user.id && p.status === "PENDING");
    if (!payment) return res.status(404).json({ message: "Bekleyen ödeme bulunamadı" });
    payment.status = "PAID";
    payment.paidAt = Date.now();
    user.signalCredits += 1;
    user.nextPriceUsd = Math.min(100, user.nextPriceUsd + 5);
    res.json({ message: "Ödeme onaylandı ve 1 sinyal hakkı eklendi", user: safeUser(user) });
  } catch (e) { next(e); }
});
module.exports = router;
