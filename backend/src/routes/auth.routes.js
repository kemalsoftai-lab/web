const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { db, id } = require("../db");
const { signToken } = require("../services/token.service");
const { sendOtpSms } = require("../services/sms.service");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2, "Ad soyad gerekli"),
  phone: z.string().min(10, "Telefon numarası geçersiz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı")
});
const loginSchema = z.object({ phone: z.string().min(10), password: z.string().min(6) });

function normalizePhone(phone) { return phone.replace(/\s+/g, ""); }
function createOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function safeUser(user) {
  return {
    id: user.id, name: user.name, phone: user.phone,
    isPhoneVerified: user.isPhoneVerified,
    signalCredits: user.signalCredits,
    usedSignals: user.usedSignals,
    nextPriceUsd: user.nextPriceUsd
  };
}
async function createAndSendOtp(user) {
  const code = createOtp();
  const codeHash = await bcrypt.hash(code, 10);
  db.otps.push({
    id: id("otp"), phone: user.phone, codeHash, userId: user.id,
    usedAt: null, expiresAt: Date.now() + 10 * 60 * 1000, createdAt: Date.now()
  });
  await sendOtpSms(user.phone, code);
}

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const phone = normalizePhone(data.phone);
    if (db.users.find((u) => u.phone === phone)) {
      return res.status(409).json({ message: "Bu telefon numarası zaten kayıtlı" });
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = {
      id: id("user"), name: data.name, phone, passwordHash,
      isPhoneVerified: false, signalCredits: 1, usedSignals: 0, nextPriceUsd: 10,
      createdAt: Date.now()
    };
    db.users.push(user);
    await createAndSendOtp(user);
    res.status(201).json({ message: "Kayıt başarıyla tamamlandı. Giriş yapabilirsiniz.", user: safeUser(user) });
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const phone = normalizePhone(data.phone);
    const user = db.users.find((u) => u.phone === phone);
    if (!user) return res.status(401).json({ message: "Telefon veya şifre hatalı" });
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Telefon veya şifre hatalı" });
    if (!user.isPhoneVerified) await createAndSendOtp(user);
    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (error) { next(error); }
});

router.post("/send-otp", requireAuth, async (req, res, next) => {
  try {
    const user = db.users.find((u) => u.id === req.user.id);
    await createAndSendOtp(user);
    res.json({ message: "Doğrulama kodu gönderildi" });
  } catch (error) { next(error); }
});

router.post("/verify-phone", async (req, res, next) => {
  try {
    const schema = z.object({ phone: z.string().min(10), code: z.string().length(6) });
    const parsed = schema.parse(req.body);
    const phone = normalizePhone(parsed.phone);
    const user = db.users.find((u) => u.phone === phone);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    const otp = db.otps
      .filter((o) => o.userId === user.id && o.phone === phone && !o.usedAt && o.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!otp) return res.status(400).json({ message: "Aktif doğrulama kodu bulunamadı. Yeni kod isteyin." });
    const valid = await bcrypt.compare(parsed.code, otp.codeHash);
    if (!valid) return res.status(400).json({ message: "Doğrulama kodu hatalı" });
    otp.usedAt = Date.now();
    user.isPhoneVerified = true;
    res.json({ message: "Telefon doğrulandı", token: signToken(user), user: safeUser(user) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, async (req, res) => res.json({ user: req.user }));
module.exports = router;
