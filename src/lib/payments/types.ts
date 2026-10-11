export interface PaymentRequest {
  tokenId: string;
  amount: number;
  currency: 'INR';
  buyerId: string;
  description: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentRef: string;
  provider: string;
  timestamp: string;
  error?: string;
}

export interface PaymentProvider {
  id: string;
  name: string;
  processPayment(request: PaymentRequest): Promise<PaymentResponse>;
}
