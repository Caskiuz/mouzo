import express from 'express';
import { authenticateToken } from '../authMiddleware';
import { GiftCardService } from '../giftCardService';

const router = express.Router();

// POST /api/gift-cards/purchase - Comprar gift card
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const {
      amount,
      recipientEmail,
      recipientPhone,
      recipientName,
      message,
      design,
    } = req.body;

    const result = await GiftCardService.purchaseGiftCard({
      purchasedBy: req.user!.id,
      amount: Math.round(amount * 100), // convertir a centavos
      recipientEmail,
      recipientPhone,
      recipientName,
      message,
      design,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Purchase gift card error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gift-cards/validate - Validar gift card
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Código requerido' });
    }

    const result = await GiftCardService.validateGiftCard(code);
    res.json(result);
  } catch (error: any) {
    console.error('Validate gift card error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/gift-cards/redeem - Canjear gift card
router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { code, orderId, amountToUse } = req.body;

    if (!code || !orderId || !amountToUse) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const result = await GiftCardService.redeemGiftCard({
      code,
      orderId,
      userId: req.user!.id,
      amountToUse: Math.round(amountToUse * 100),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Redeem gift card error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gift-cards/my-cards - Obtener gift cards del usuario
router.get('/my-cards', authenticateToken, async (req, res) => {
  try {
    const result = await GiftCardService.getUserGiftCards(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('Get user gift cards error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gift-cards/designs - Obtener diseños disponibles
router.get('/designs', async (req, res) => {
  try {
    const result = await GiftCardService.getDesigns();
    res.json(result);
  } catch (error: any) {
    console.error('Get designs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/gift-cards/:giftCardId/history - Historial de transacciones
router.get('/:giftCardId/history', authenticateToken, async (req, res) => {
  try {
    const { giftCardId } = req.params;
    const result = await GiftCardService.getTransactionHistory(giftCardId);
    res.json(result);
  } catch (error: any) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
