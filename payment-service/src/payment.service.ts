import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }

  async createPayment(dto: CreatePaymentDto) {
    const preference = new Preference(this.client);

    const response = await preference.create({
      body: {
        items: [
          {
            id: 'mandarina',
            title: dto.description,
            quantity: 1,
            unit_price: dto.amount,
          },
        ],
        metadata: {
          orderId: dto.orderId,
        },
        back_urls: {
          success: 'http://localhost:3000/payment/success',
          failure: 'http://localhost:3000/payment/failure',
          pending: 'http://localhost:3000/payment/pending',
        },
        auto_return: 'approved',
      },
    });

    return {
      checkoutUrl: response.init_point,
      preferenceId: response.id,
    };
  }
}
