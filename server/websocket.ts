import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 WebSocket connected: ${socket.id}`);

    // Join room por rol
    socket.on('join', (data: { userId: string; role: string; businessId?: string }) => {
      socket.join(`user:${data.userId}`);
      if (data.role === 'business_owner' && data.businessId) {
        socket.join(`business:${data.businessId}`);
        logger.info(`👔 Business ${data.businessId} joined room`);
      }
      if (data.role === 'delivery_driver') {
        socket.join('drivers');
        logger.info(`🚗 Driver ${data.userId} joined drivers room`);
      }
      if (data.role === 'admin') {
        socket.join('admins');
        logger.info(`👨‍💼 Admin ${data.userId} joined admins room`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 WebSocket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('WebSocket not initialized');
  return io;
}

// Eventos específicos
export function notifyNewOrder(businessId: string, order: any) {
  if (!io) return;
  io.to(`business:${businessId}`).emit('new_order', order);
  io.to('admins').emit('new_order', order);
  logger.info(`📦 New order notification sent to business ${businessId}`);
}

export function notifyOrderStatusChange(userId: string, orderId: string, status: string) {
  if (!io) return;
  io.to(`user:${userId}`).emit('order_status_changed', { orderId, status });
}

export function notifyDriverAssigned(driverId: string, order: any) {
  if (!io) return;
  io.to(`user:${driverId}`).emit('order_assigned', order);
}

export function notifyPaymentVerified(businessId: string, orderId: string) {
  if (!io) return;
  io.to(`business:${businessId}`).emit('payment_verified', { orderId });
}
