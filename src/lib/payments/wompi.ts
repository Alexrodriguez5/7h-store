import { createHash } from "node:crypto";
import type { PaymentGateway, GatewayOrder } from "./gateway";

export class WompiGateway implements PaymentGateway {
  async createCheckout(order: GatewayOrder) {
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

    if (!publicKey) {
      throw new Error("WOMPI_PUBLIC_KEY no configurada");
    }

    if (!integritySecret) {
      throw new Error("WOMPI_INTEGRITY_SECRET no configurada");
    }

    const amountInCents = order.totalCOP * 100;
    const currency = "COP";

    const integrityString =
      `${order.publicCode}${amountInCents}${currency}${integritySecret}`;

    const integritySignature = createHash("sha256")
      .update(integrityString)
      .digest("hex");

    const params = new URLSearchParams({
      "public-key": publicKey,
      currency,
      "amount-in-cents": String(amountInCents),
      reference: order.publicCode,
      "signature:integrity": integritySignature,
    });

    return {
      redirectUrl: `https://checkout.wompi.co/p/?${params.toString()}`,
      providerRef: order.publicCode,
    };
  }

  async verifyWebhook(req: Request) {
    const body = await req.text();

    const payload = JSON.parse(body) as {
      event?: string;

      data?: unknown;

      environment?: string;

      signature?: {
        checksum?: string;
        properties?: string[];
      };

      timestamp?: number;

      sent_at?: string;
    };

    const secret = process.env.WOMPI_EVENTS_SECRET;
    const signature = payload.signature;

    if (
      !secret ||
      !signature?.checksum ||
      !signature.properties ||
      payload.timestamp === undefined
    ) {
      throw new Error(
        "Firma Wompi no disponible"
      );
    }

    const propertyValues = signature.properties
      .map((path) => {
        const value = getPath(
          payload.data,
          path
        );

        return String(value ?? "");
      })
      .join("");

    const values =
      propertyValues +
      String(payload.timestamp) +
      secret;

    const expected = createHash("sha256")
      .update(values)
      .digest("hex");

    if (expected !== signature.checksum) {
      throw new Error(
        "Firma inválida"
      );
    }

    const transaction = getPath(
      payload.data,
      "transaction"
    ) as Record<string, unknown> | undefined;

    const providerRef =
      typeof transaction?.id === "string"
        ? transaction.id
        : "";

    const publicCode =
      typeof transaction?.reference === "string"
        ? transaction.reference
        : "";

    const rawStatus =
      typeof transaction?.status === "string"
        ? transaction.status
        : "PENDING";

    const status:
      | "APPROVED"
      | "DECLINED"
      | "PENDING" =
      rawStatus === "APPROVED"
        ? "APPROVED"
        : rawStatus === "DECLINED"
          ? "DECLINED"
          : "PENDING";

    return {
      providerRef,
      status,
      publicCode,
      rawPayload: payload,
    };
  }
}

function getPath(
  root: unknown,
  path: string
): unknown {
  return path.split(".").reduce<unknown>(
    (value, key) =>
      value !== null &&
      typeof value === "object" &&
      key in value
        ? (value as Record<string, unknown>)[key]
        : undefined,
    root
  );
}