import { PaymentProvider, PaymentRequest, PaymentResponse } from './types';

/**
 * DemoUPI Provider
 * Simulates a realistic Indian Unified Payments Interface (UPI) transaction.
 * Designed to be dropped in and swapped with Razorpay, Cashfree, or PhonePe PG.
 */
export class DemoUPIProvider implements PaymentProvider {
  id = 'demo_upi';
  name = 'Demo UPI (Simulation)';

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // Generate realistic UPI Reference Number (e.g., UPI/DEMO/492104928172)
    const randomDigits = Math.floor(100000000000 + Math.random() * 900000000000);
    const paymentRef = `UPI/DEMO/${randomDigits}`;

    return {
      success: true,
      paymentRef,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };
  }
}

export const defaultPaymentProvider = new DemoUPIProvider();
