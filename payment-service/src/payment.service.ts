import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    });
  }

  async createPayment(dto: CreatePaymentDto) {
    const preference = new Preference(this.client);
    const response = await preference.create({
      body: {
        binary_mode: true,
        items: [
          {
            id: 'mandarina',
            title: dto.description,
            quantity: 1,
            unit_price: dto.amount,
          },
        ],
        payer: {
          name: 'Juan',
          surname: 'Lopez',
          email: 'user@email.com',
          phone: {
            area_code: '11',
            number: '4444-4444',
          },
          identification: {
            type: 'DNI',
            number: '12345678',
          },
          address: {
            street_name: 'Street',
            street_number: '123',
            zip_code: '5700',
          },
        },
        metadata: {
          orderId: dto.orderId,
        },
        back_urls: {
          success: 'https://localhost:3004/payment/success',
          failure: 'https://localhost:3004/payment/failure',
          pending: 'https://localhost:3004/payment/pending',
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
