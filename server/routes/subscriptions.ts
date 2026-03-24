import express from 'express';
import { authenticateToken } from '../authMiddleware';
import { SubscriptionService } from '../subscriptionService';

const router = express.Router();

// Obtener suscripción del usuario
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await SubscriptionService.getUserSubscription(req.user!.id);
    res.json({ success: true, subscription });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener planes disponibles
router.get('/plans', async (req, res) => {
  res.json({
    success: true,
    plans: SubscriptionService.PLANS,
  });
});

// Suscribirse a un plan
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;
    
    if (!['premium', 'business'].includes(plan)) {
      return res.status(400).json({ error: 'Plan inválido' });
    }

    const result = await SubscriptionService.subscribe(req.user!.id, plan, billingCycle);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar suscripción
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const result = await SubscriptionService.cancelSubscription(req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
