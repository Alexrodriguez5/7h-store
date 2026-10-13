import { createHash, timingSafeEqual } from "node:crypto";
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
    // Wompi envía el checksum en el cuerpo y también en la cabecera X-Event-Checksum.
    const received = signature?.checksum ?? req.headers.get("x-event-checksum") ?? undefined;

    if (
      !secret ||
      !received ||
      !Array.isArray(signature?.properties) ||
      payload.timestamp === undefined
    ) {
      throw new Error(
        "Firma Wompi no disponible"
      );
    }

    const propertyValues = signature.properties
      .map((path: string) => {
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

    // Wompi publica el checksum en hexadecimal MAYÚSCULA y digest("hex") produce minúsculas:
    // se normaliza antes de comparar (en tiempo constante). Antes, esta diferencia hacía que
    // TODOS los eventos reales se rechazaran como "Firma inválida".
    if (!checksumMatches(expected, received)) {
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

    if (!providerRef || !publicCode) {
      throw new Error("Evento sin transacción o referencia");
    }

    // Estados finales de Wompi: APPROVED, DECLINED, VOIDED, ERROR.
    const status:
      | "APPROVED"
      | "DECLINED"
      | "PENDING" =
      rawStatus === "APPROVED"
        ? "APPROVED"
        : rawStatus === "DECLINED" || rawStatus === "ERROR" || rawStatus === "VOIDED"
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

/** Compara dos checksums SHA-256 en hexadecimal sin distinguir mayúsculas y en tiempo constante. */
export function checksumMatches(expectedHex: string, receivedHex: string): boolean {
  const a = expectedHex.trim().toLowerCase();
  const b = receivedHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
