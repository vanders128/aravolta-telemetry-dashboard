import { noStoreError, noStoreJson } from "@/lib/server/http/no-store-json";
import { getRecentDeviceMetrics } from "@/lib/server/services/device-query-service";
import { metricWindowQuerySchema } from "@/lib/telemetry/query-window";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const parsedQuery = metricWindowQuerySchema.safeParse({
    windowSeconds:
      new URL(request.url).searchParams.get("windowSeconds") ?? undefined,
  });

  if (!parsedQuery.success) {
    return noStoreError(
      400,
      "INVALID_QUERY",
      "windowSeconds must be an integer between 1 and 3600.",
    );
  }

  const { id } = await context.params;

  try {
    const result = await getRecentDeviceMetrics(
      id,
      parsedQuery.data.windowSeconds,
    );

    if (result.outcome === "device-not-found") {
      return noStoreError(
        404,
        "DEVICE_NOT_FOUND",
        `Device '${id}' was not found.`,
      );
    }

    return noStoreJson({ data: result.data, meta: result.meta });
  } catch (error) {
    console.error("Device metric query failed.", error);

    return noStoreError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to retrieve device metrics.",
    );
  }
}
