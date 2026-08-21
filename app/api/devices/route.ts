import { noStoreError, noStoreJson } from "@/lib/server/http/no-store-json";
import { listDevices } from "@/lib/server/services/device-query-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listDevices();

    return noStoreJson({
      data: { devices: result.devices },
      meta: { asOf: result.asOf },
    });
  } catch (error) {
    console.error("Device listing failed.", error);

    return noStoreError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to retrieve devices.",
    );
  }
}
