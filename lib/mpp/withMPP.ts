import { getPriceForRoute } from "./pricing"
import { verifyPayment } from "./providers"
import { createSession, getSession, chargeSession } from "./session"
import { isReplay } from "./replay"

export function withMPP(handler: Function) {
  return async (req: Request, context?: any) => {
    const path = new URL(req.url).pathname
    const price = getPriceForRoute(path)

    const payment = req.headers.get("x-mpp-payment")
    const sessionId = req.headers.get("x-mpp-session")

    if (sessionId) {
      const session = getSession(sessionId)

      if (!session) {
        return Response.json({ error: "invalid_session" }, { status: 402 })
      }

      if (!chargeSession(sessionId, price)) {
        return Response.json(
          { error: "insufficient_balance", required: price },
          { status: 402 }
        )
      }

      return handler(req, context)
    }

    if (payment) {
      if (isReplay(payment)) {
        return Response.json({ error: "replayed_payment" }, { status: 402 })
      }

      const valid = await verifyPayment(payment)

      if (!valid) {
        return Response.json({ error: "invalid_payment" }, { status: 402 })
      }

      return handler(req, context)
    }

    const session = createSession()

    return Response.json(
      {
        error: "payment_required",
        price,
        session
      },
      { status: 402 }
    )
  }
}