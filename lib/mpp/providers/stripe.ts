import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20"
})

export async function verifyStripePayment(paymentId: string) {
  try {
    const payment = await stripe.paymentIntents.retrieve(paymentId)
    return payment.status === "succeeded"
  } catch {
    return false
  }
}