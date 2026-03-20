// Nuevo sistema de comisiones simplificado
export class NewCommissionService {
  
  /**
   * Calcula las comisiones con el nuevo sistema:
   * - Productos: 100% al negocio
   * - Delivery: 100% al repartidor
   * - Comisión MOUZO: 15% sobre productos
   */
  static calculateCommissions(subtotal: number, deliveryFee: number) {
    const productAmount = subtotal; // Precio base de productos
    const mouzoCommission = Math.round(productAmount * 0.15); // 15% sobre productos
    
    return {
      // Lo que recibe cada parte
      business: productAmount, // 100% de productos
      driver: deliveryFee, // 100% de delivery
      mouzo: mouzoCommission, // 15% sobre productos
      
      // Totales para verificación
      total: productAmount + deliveryFee + mouzoCommission,
      productBase: productAmount,
      deliveryBase: deliveryFee
    };
  }
  
  /**
   * Calcula el total que debe pagar el cliente
   */
  static calculateCustomerTotal(subtotal: number, deliveryFee: number) {
    const commissions = this.calculateCommissions(subtotal, deliveryFee);
    return commissions.total;
  }
}