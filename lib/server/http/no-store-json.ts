const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

export function noStoreError(status: number, code: string, message: string) {
  return noStoreJson(
    {
      error: {
        code,
        message,
      },
    },
    status,
  );
}
