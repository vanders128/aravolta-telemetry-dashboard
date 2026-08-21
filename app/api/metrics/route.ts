import { ingestTelemetry } from "@/lib/server/services/telemetry-ingestion-service";
import { telemetryIngestionSchema } from "@/lib/telemetry/ingestion-schema";

export const runtime = "nodejs";

type ErrorDetail = {
  field: string;
  message: string;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
) {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const parsed = telemetryIngestionSchema.safeParse(body);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));

    return errorResponse(
      422,
      "VALIDATION_ERROR",
      "Telemetry payload is invalid.",
      details,
    );
  }

  try {
    const result = await ingestTelemetry(parsed.data);

    if (result.outcome === "device-not-found") {
      return errorResponse(
        404,
        "DEVICE_NOT_FOUND",
        `Device '${parsed.data.deviceId}' was not found.`,
      );
    }

    return Response.json({ data: result.metric }, { status: 201 });
  } catch (error) {
    console.error("Telemetry ingestion failed.", error);

    return errorResponse(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to persist telemetry.",
    );
  }
}
