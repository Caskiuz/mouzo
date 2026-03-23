import express from 'express';
import { authenticateToken, requireRole } from '../authMiddleware';
import { SupportService } from '../supportService';

const router = express.Router();

// Crear ticket
router.post('/tickets', authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.createTicket({
      userId: req.user!.id,
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tickets del usuario
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await SupportService.getUserTickets(req.user!.id);
    res.json({ success: true, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ticket específico
router.get('/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const data = await SupportService.getTicket(req.params.id, req.user!.id);
    res.json({ success: true, ...data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Agregar mensaje
router.post('/tickets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const result = await SupportService.addMessage({
      ticketId: req.params.id,
      senderId: req.user!.id,
      senderType: req.user!.role === 'admin' || req.user!.role === 'super_admin' ? 'admin' : 'user',
      ...req.body,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado (solo admin)
router.patch('/tickets/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await SupportService.updateTicketStatus(req.params.id, req.body.status, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tickets pendientes (solo admin)
router.get('/admin/pending', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const tickets = await SupportService.getPendingTickets();
    res.json({ success: true, tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Asignar ticket (solo admin)
router.post('/tickets/:id/assign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await SupportService.assignTicket(req.params.id, req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
