# Get Available Lines

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/postal/get-available-lines:
    get:
      summary: Get Available Lines
      deprecated: false
      description: ''
      tags:
        - Send/PostalCode
      parameters:
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      responses:
        '401':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  message:
                    type: string
                  data:
                    type: 'null'
                required:
                  - status
                  - message
                  - data
                x-apidog-orders:
                  - status
                  - message
                  - data
          headers: {}
          x-apidog-name: ''
      security:
        - apikey-header-Api-Key: []
          x-apidog:
            required: true
            schemeGroups:
              - id: rrEUm8r20jlegQsHsH4Y3
                schemeIds:
                  - apikey-header-Api-Key
            use:
              id: rrEUm8r20jlegQsHsH4Y3
      x-apidog-folder: Send/PostalCode
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31205874-run
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