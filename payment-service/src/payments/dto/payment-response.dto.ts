export class PaymentResponseDto {
  success: boolean;
  message: string;
  data: {
    checkoutUrl: string;
    preferenceId: string;
    orderId: string;
  };
}

// dto/payment-callback.dto.ts
export class PaymentCallbackDto {
  payment_id: string;
  status: string;
  external_reference: string;
  merchant_order_id?: string;
  preference_id?: string;
}
