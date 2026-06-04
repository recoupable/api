import { verifyStripePayment } from "./stripe"

export async function verifyPayment(payment: string) {
  return verifyStripePayment(payment)
}