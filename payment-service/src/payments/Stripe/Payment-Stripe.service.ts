import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  async createStripeSession(order: any) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: order.items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.productSnapshot.name },
          unit_amount: Math.round(item.unitPrice * 100), // Stripe usa centavos
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel?id=${order.id}`,
      metadata: { orderId: order.id }, // 👈 Vital para el Webhook
    });

    return { url: session.url };
  }
}
