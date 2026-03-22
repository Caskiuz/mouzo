import express from "express";
import { authenticateToken } from "../authMiddleware";
import { eq, or, like } from "drizzle-orm";

const router = express.Router();

// Send verification code
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const normalizedPhone = phone.startsWith('+') ? phone.replace(/[\s-()]/g, '') : 
                           phone.replace(/[^\d]/g, '').length === 10 ? `+58${phone.replace(/[^\d]/g, '')}` :
                           `+${phone.replace(/[^\d]/g, '')}`;
    const phoneDigits = normalizedPhone.replace(/[^\d]/g, '');

    console.log('📱 Phone normalization:', { original: phone, normalized: normalizedPhone });

    let user = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.phone, normalizedPhone),
          eq(users.phone, phone),
          like(users.phone, `%${phoneDigits.slice(-10)}`)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.json({ 
        success: false, 
        userNotFound: true,
        message: "Usuario no encontrado. Debes registrarte primero."
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`🔐 Verification code for ${normalizedPhone}: ${code}`);

    await db
      .update(users)
      .set({ 
        verificationCode: code,
        verificationExpires: expiresAt 
      })
      .where(eq(users.id, user[0].id));

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = await import("twilio");
        const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `Tu código de verificación MOUZO es: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: normalizedPhone
        });
        console.log(`✅ SMS sent to ${normalizedPhone}`);
      } catch (twilioError) {
        console.error("Twilio error:", twilioError);
      }
    } else {
      console.log(`[DEV] Código de verificación para ${normalizedPhone}: ${code}`);
    }

    res.json({ 
      success: true, 
      message: "Código de verificación enviado",
      ...(process.env.NODE_ENV === "development" && { devCode: code })
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Phone login
router.post("/phone-login", async (req, res) => {
  try {
    const { phone, code, name } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: "Phone and code are required" });
    }

    const { users, deliveryDrivers, wallets } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const jwt = await import("jsonwebtoken");

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const normalizedPhone = phoneDigits.startsWith('52') ? `+${phoneDigits}` : 
                           phoneDigits.length === 10 ? `+58${phoneDigits}` :
                           phone.startsWith('+') ? phone : `+58${phoneDigits}`;

    console.log('📱 Phone normalization in phone-login:', { original: phone, digits: phoneDigits, normalized: normalizedPhone });

    let user = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.phone, normalizedPhone),
          eq(users.phone, phone),
          eq(users.phone, `+58 ${phoneDigits.slice(-10, -7)} ${phoneDigits.slice(-7, -4)} ${phoneDigits.slice(-4)}`),
          eq(users.phone, `+58${phoneDigits.slice(-10)}`),
          like(users.phone, `%${phoneDigits.slice(-10)}`)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado. Debes registrarte primero." });
    }

    if (!user[0].verificationCode || user[0].verificationCode !== code) {
      const testPhones = [
        "+58 341 234 5678", "+58 341 456 7892", "+583414567892",
        "+58 341 345 6789", "+58 341 456 7890", "+58 341 567 8901",
        "+58 317 123 4567", "+58 317 234 5678", "+58 317 345 6789",
        "+583414567890", "+58 3414567890", "+58 341 456 7890"
      ];
      
      const isTestPhone = testPhones.some(testPhone => {
        const testDigits = testPhone.replace(/[^\d]/g, '');
        return phoneDigits.slice(-10) === testDigits.slice(-10);
      });
      
      if (process.env.NODE_ENV === "development" && code === "1234" && isTestPhone) {
        console.log("✅ Using 1234 fallback for test phone:", normalizedPhone);
      } else {
        return res.status(400).json({ error: "Código de verificación inválido" });
      }
    }

    if (user[0].verificationExpires && new Date() > new Date(user[0].verificationExpires)) {
      return res.status(400).json({ error: "Código expirado. Solicita uno nuevo." });
    }

    await db
      .update(users)
      .set({ 
        verificationCode: null, 
        verificationExpires: null,
        phoneVerified: true 
      })
      .where(eq(users.id, user[0].id));

    if (user[0].role === "delivery_driver") {
      const [existingDriver] = await db
        .select({ id: deliveryDrivers.id })
        .from(deliveryDrivers)
        .where(eq(deliveryDrivers.userId, user[0].id))
        .limit(1);

      if (!existingDriver) {
        await db.insert(deliveryDrivers).values({
          userId: user[0].id,
          vehicleType: "bike",
          vehiclePlate: null,
          isAvailable: false,
          totalDeliveries: 0,
          rating: 0,
          totalRatings: 0,
          strikes: 0,
          isBlocked: false,
        });
      }

      const [existingWallet] = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(eq(wallets.userId, user[0].id))
        .limit(1);

      if (!existingWallet) {
        await db.insert(wallets).values({
          userId: user[0].id,
          balance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        });
      }
    }

    const token = jwt.default.sign(
      {
        id: user[0].id,
        phone: user[0].phone,
        role: user[0].role,
      },
      process.env.JWT_SECRET || "demo-secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        name: user[0].name,
        phone: user[0].phone,
        role: user[0].role,
        phoneVerified: user[0].phoneVerified,
        isActive: user[0].isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dev login
router.post("/dev-login", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const jwt = await import("jsonwebtoken");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const token = jwt.default.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "production-secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
