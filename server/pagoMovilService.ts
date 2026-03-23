import { db } from './db';
import { orders, pagoMovilVerifications } from '../shared/schema-mysql';
import { eq, and } from 'drizzle-orm';
import { notifyPagoMovilStatus } from './enhancedPushService';

// Datos de la cuenta MOUZO para recibir pagos
export const MOUZO_PAGO_MOVIL = {
  phone: process.env.MOUZO_PAGO_MOVIL_PHONE || '0414-000-0000',
  bank: process.env.MOUZO_PAGO_MOVIL_BANK || 'banesco',
  cedula: process.env.MOUZO_PAGO_MOVIL_CEDULA || 'V-00000000',
  bankName: process.env.MOUZO_PAGO_MOVIL_BANK_NAME || 'Banesco',
};

export const VENEZUELA_BANKS = [
  { id: 'banesco', name: 'Banesco', code: '0134' },
  { id: 'bdv', name: 'Banco de Venezuela', code: '0102' },
  { id: 'mercantil', name: 'Mercantil', code: '0105' },
  { id: 'provincial', name: 'BBVA Provincial', code: '0108' },
  { id: 'bicentenario', name: 'Bicentenario', code: '0175' },
  { id: 'bnc', name: 'BNC', code: '0191' },
  { id: 'sofitasa', name: 'Sofitasa', code: '0137' },
  { id: 'exterior', name: 'Banco Exterior', code: '0115' },
  { id: 'venezolano', name: 'Venezolano de Crédito', code: '0104' },
  { id: 'plaza', name: 'Banco Plaza', code: '0138' },
  { id: 'fondo_comun', name: 'Fondo Común', code: '0151' },
  { id: '100porciento', name: '100% Banco', code: '0156' },
  { id: 'del_sur', name: 'Del Sur', code: '0157' },
  { id: 'activo', name: 'Banco Activo', code: '0171' },
  { id: 'caroní', name: 'Caroní', code: '0128' },
];

// Genera referencia única por pedido: MOUZO-XXXXX
export function generateReference(orderId: string): string {
  const suffix = orderId.replace(/-/g, '').substring(0, 6).toUpperCase();
  return `MOUZO-${suffix}`;
}

// Inicia el proceso de pago móvil para un pedido
export async function initPagoMovil(orderId: string, userId: string, amount: number) {
  const reference = generateReference(orderId);

  // Verificar si ya existe
  const existing = await db.select()
    .from(pagoMovilVerifications)
    .where(eq(pagoMovilVerifications.orderId, orderId))
    .limit(1);

  if (existing.length > 0) return { reference, mouzo: MOUZO_PAGO_MOVIL, existing: existing[0] };

  await db.insert(pagoMovilVerifications).values({
    orderId,
    userId,
    reference,
    amount,
    destPhone: MOUZO_PAGO_MOVIL.phone,
    destBank: MOUZO_PAGO_MOVIL.bank,
    destCedula: MOUZO_PAGO_MOVIL.cedula,
    status: 'pending',
  });

  // Actualizar orden con referencia
  await db.update(orders)
    .set({ pagoMovilReference: reference, pagoMovilStatus: 'pending' })
    .where(eq(orders.id, orderId));

  return { reference, mouzo: MOUZO_PAGO_MOVIL };
}

// Cliente sube comprobante y datos del pago
export async function submitComprobante(
  orderId: string,
  userId: string,
  data: {
    reference: string;
    clientPhone: string;
    clientBank: string;
    proofUrl?: string;
  }
) {
  const [verification] = await db.select()
    .from(pagoMovilVerifications)
    .where(and(
      eq(pagoMovilVerifications.orderId, orderId),
      eq(pagoMovilVerifications.userId, userId),
    ))
    .limit(1);

  if (!verification) throw new Error('Verificación no encontrada');
  if (verification.status === 'verified') throw new Error('Pago ya verificado');

  await db.update(pagoMovilVerifications)
    .set({
      clientPhone: data.clientPhone,
      clientBank: data.clientBank,
      proofUrl: data.proofUrl || null,
      status: 'verifying',
    })
    .where(eq(pagoMovilVerifications.id, verification.id));

  await db.update(orders)
    .set({
      pagoMovilPhone: data.clientPhone,
      pagoMovilBank: data.clientBank,
      pagoMovilProofUrl: data.proofUrl || null,
      pagoMovilStatus: 'verifying',
    })
    .where(eq(orders.id, orderId));

  return { status: 'verifying', message: 'Comprobante recibido, en verificación' };
}

// Admin verifica y aprueba el pago
export async function verifyPagoMovil(verificationId: string, adminId: string) {
  const [verification] = await db.select()
    .from(pagoMovilVerifications)
    .where(eq(pagoMovilVerifications.id, verificationId))
    .limit(1);

  if (!verification) throw new Error('Verificación no encontrada');

  await db.update(pagoMovilVerifications)
    .set({ status: 'verified', verifiedBy: adminId, verifiedAt: new Date() })
    .where(eq(pagoMovilVerifications.id, verificationId));

  await db.update(orders)
    .set({
      pagoMovilStatus: 'verified',
      pagoMovilVerifiedBy: adminId,
      pagoMovilVerifiedAt: new Date(),
      paidAt: new Date(),
      status: 'accepted',
    })
    .where(eq(orders.id, verification.orderId));

  await notifyPagoMovilStatus(verification.userId, 'verified', verification.orderId);

  return { success: true, orderId: verification.orderId };
}

// Admin rechaza el pago
export async function rejectPagoMovil(verificationId: string, adminId: string, reason: string) {
  const [verification] = await db.select()
    .from(pagoMovilVerifications)
    .where(eq(pagoMovilVerifications.id, verificationId))
    .limit(1);

  if (!verification) throw new Error('Verificación no encontrada');

  await db.update(pagoMovilVerifications)
    .set({ status: 'rejected', verifiedBy: adminId, rejectedReason: reason })
    .where(eq(pagoMovilVerifications.id, verificationId));

  await db.update(orders)
    .set({ pagoMovilStatus: 'rejected', pagoMovilRejectedReason: reason })
    .where(eq(orders.id, verification.orderId));

  await notifyPagoMovilStatus(verification.userId, 'rejected', verification.orderId, reason);

  return { success: true, orderId: verification.orderId };
}

// Obtener pagos pendientes de verificación (para panel admin)
export async function getPendingVerifications() {
  return db.select()
    .from(pagoMovilVerifications)
    .where(eq(pagoMovilVerifications.status, 'verifying'));
}
