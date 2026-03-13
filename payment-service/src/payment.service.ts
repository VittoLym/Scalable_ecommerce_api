import { Injectable } from '@nestjs/common';
import mercadopago from './payments/MercadoPago/mercadopago.config';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

@Injectable()
export class PaymentService {
  async createPreference(data: CreatePaymentDto) {
    const preference = {
      items: [
        {
          title: data.description,
          quantity: 1,
          unit_price: data.amount,
        },
      ],
      metadata: {
        orderId: data.orderId,
      },
      back_urls: {
        success: 'http://localhost:3000/payment/success',
        failure: 'http://localhost:3000/payment/failure',
      },
      auto_return: 'approved',
    };

    const response = await mercadopago.preferences.create(preference);

    return {
      checkoutUrl: response.body.init_point,
      preferenceId: response.body.id,
    };
  }
}
