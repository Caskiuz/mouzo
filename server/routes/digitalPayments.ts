// Digital Payment Routes
import { Router } from "express";
import { digitalPaymentService } from "../digitalPaymentService";
import { authenticateToken } from "../authMiddleware";
import { requireRole } from "../rbacMiddleware";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const upload = multer({
  dest: path.join(process.cwd(), "server/uploads/comprobantes"),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// GET /api/digital-payments/metrics — admin: métricas de todos los métodos de pago
router.get("/metrics", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const metrics = await digitalPaymentService.getPaymentMetrics();
    res.json({ success: true, ...metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/digital-payments/ocr — extraer datos de comprobante con Gemini (cualquier método)
router.post("/ocr", authenticateToken, upload.single("proof"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió imagen" });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "OCR no disponible" });

    const imageBase64 = fs.readFileSync(req.file.path).toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extrae del comprobante de pago: número de referencia/transacción, monto, teléfono origen (si aplica), banco origen (si aplica), método de pago (pago_movil, binance, zinli, zelle, paypal). Responde SOLO con JSON: {"reference": "", "amount": 0, "phone": "", "bank": "", "method": ""}. Si no encuentras un campo, déjalo vacío.' },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          }],
        }),
      }
    );

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[^}]+\}/);
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    fs.unlinkSync(req.file.path);
    res.json({ success: true, extracted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active payment methods
router.get("/methods", authenticateToken, async (req, res) => {
  try {
    const methods = await digitalPaymentService.getActivePaymentMethods();
    res.json({ success: true, methods });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit payment proof (Customer)
router.post("/proof/submit", authenticateToken, async (req, res) => {
  try {
    const { orderId, paymentProvider, referenceNumber, proofImageUrl, amount } = req.body;

    if (!orderId || !paymentProvider || !referenceNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: orderId, paymentProvider, referenceNumber, amount",
      });
    }

    const result = await digitalPaymentService.submitPaymentProof({
      orderId,
      userId: req.user!.id,
      paymentProvider,
      referenceNumber,
      proofImageUrl,
      amount,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment proof by order ID
router.get("/proof/order/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const proof = await digitalPaymentService.getPaymentProofByOrderId(orderId);

    if (!proof) {
      return res.status(404).json({ success: false, error: "Comprobante no encontrado" });
    }

    res.json({ success: true, proof });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending payment proofs (Admin only)
router.get("/proof/pending", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const proofs = await digitalPaymentService.getPendingPaymentProofs();
    res.json({ success: true, proofs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify payment proof (Admin only)
router.post("/proof/verify", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { proofId, approved, notes } = req.body;

    if (!proofId || typeof approved !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: proofId, approved",
      });
    }

    const result = await digitalPaymentService.verifyPaymentProof(
      proofId,
      req.user!.id,
      approved,
      notes
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process PayPal payment
router.post("/paypal/process", authenticateToken, async (req, res) => {
  try {
    const { orderId, paypalTransactionId } = req.body;

    if (!orderId || !paypalTransactionId) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: orderId, paypalTransactionId",
      });
    }

    const result = await digitalPaymentService.processPayPalPayment(orderId, paypalTransactionId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
