-- CreateTable
CREATE TABLE "devices" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "location" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" BIGSERIAL NOT NULL,
    "device_id" VARCHAR(64) NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metrics_device_recorded_at_desc_idx" ON "metrics"("device_id", "recorded_at" DESC);

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
