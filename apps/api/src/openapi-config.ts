import { DocumentBuilder } from "@nestjs/swagger";

/**
 * Общая конфигурация документа для main.ts (живой /docs в dev) и для
 * generate-openapi.ts (статический packages/contracts/openapi.json).
 * Один источник, чтобы они не разъезжались.
 */
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Посылки API")
    .setDescription(
      "REST API сервиса попутной доставки посылок. " +
        "Единственный источник правды для клиентских типов (см. E01 п. 1.17).",
    )
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();
}
