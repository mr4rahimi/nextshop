# Pay Created Order

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/orders/pay:
    post:
      summary: Pay Created Order
      deprecated: false
      description: ''
      tags:
        - Orders
      parameters:
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                orderId:
                  type: string
                  examples:
                    - '2'
                  example: '2'
                paymentSource:
                  description: wallet | gateway | partialGatewayAndWallet
                  type: string
                  examples:
                    - gateway
                  example: gateway
                redirectUrl:
                  description: nullable
                  type: string
                  examples:
                    - https://test.com
                  example: https://test.com
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
                x-apidog-orders: []
          headers: {}
          x-apidog-name: ''
      security:
        - bearer: []
          x-apidog:
            required: true
            schemeGroups:
              - id: R_7RhPXKMfI_PzsG6bW1C
                schemeIds:
                  - bearer
            use:
              id: R_7RhPXKMfI_PzsG6bW1C
      x-apidog-folder: Orders
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-25851395-run
components:
  schemas: {}
  securitySchemes:
    bearer:
      type: bearer
      scheme: bearer
    apikey-header-Api-Key:
      type: apiKey
      in: header
      name: Api-Key
servers:
  - url: https://api.iranpayamak.com
    description: Prod Env
security:
  - apikey-header-Api-Key: []

```