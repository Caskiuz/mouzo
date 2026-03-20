import { Router } from 'express';
import { authenticateToken, requireRole } from './authMiddleware';
import {
  initPagoMovil,
  submitComprobante,
  verifyPagoMovil,
  rejectPagoMovil,
  getPendingVerifications,
  VENEZUELA_BANKS,
  MOUZO_PAGO_MOVIL,
} from './pagoMovilService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Multer para subir comprobantes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'server/uploads/comprobantes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// GET /api/pago-movil/banks — lista de bancos venezolanos
router.get('/banks', (req, res) => {
  res.json({ banks: VENEZUELA_BANKS });
});

// GET /api/pago-movil/info — datos de la cuenta MOUZO para pagar
router.get('/info', authenticateToken, (req, res) => {
  res.json({ mouzo: MOUZO_PAGO_MOVIL });
});

// POST /api/pago-movil/init/:orderId — iniciar proceso de pago para un pedido
router.post('/init/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;
    const userId = (req as any).user.id;
    const result = await initPagoMovil(orderId, userId, amount);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pago-movil/submit/:orderId — cliente envía comprobante
router.post('/submit/:orderId', authenticateToken, upload.single('proof'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;
    const { clientPhone, clientBank } = req.body;

    let proofUrl: string | undefined;
    if (req.file) {
      proofUrl = `/uploads/comprobantes/${req.file.filename}`;
    }

    const result = await submitComprobante(orderId, userId, {
      reference: req.body.reference,
      clientPhone,
      clientBank,
      proofUrl,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/pago-movil/pending — admin: ver pagos pendientes
router.get('/pending', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const pending = await getPendingVerifications();
    res.json({ verifications: pending });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pago-movil/verify/:id — admin: aprobar pago
router.post('/verify/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const adminId = (req as any).user.id;
    const result = await verifyPagoMovil(req.params.id, adminId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pago-movil/reject/:id — admin: rechazar pago
router.post('/reject/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const adminId = (req as any).user.id;
    const { reason } = req.body;
    const result = await rejectPagoMovil(req.params.id, adminId, reason || 'Comprobante inválido');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
