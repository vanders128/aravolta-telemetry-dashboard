import { noStoreError, noStoreJson } from "@/lib/server/http/no-store-json";
import { getLiveDeviceSnapshot } from "@/lib/server/services/device-query-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await getLiveDeviceSnapshot(id);

    if (result.outcome === "device-not-found") {
      return noStoreError(
        404,
        "DEVICE_NOT_FOUND",
        `Device '${id}' was not found.`,
      );
    }

    return noStoreJson({ data: result.data, meta: result.meta });
  } catch (error) {
    console.error("Live device query failed.", error);

    return noStoreError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to retrieve live device telemetry.",
    );
  }
}
