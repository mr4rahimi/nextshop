# Lines

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/lines/accessible:
    get:
      summary: Lines
      deprecated: false
      description: ''
      tags:
        - Account
      parameters:
        - name: search
          in: query
          description: ''
          required: false
          example: '0210000000'
          schema:
            type: string
        - name: is_dedicated
          in: query
          description: ''
          required: false
          example: '1'
          schema:
            type: boolean
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
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
          x-apidog-name: OK
      security:
        - bearer: []
          x-apidog:
            required: true
            schemeGroups:
              - id: Y5FiB-47DZMc_agIH_b8r
                schemeIds:
                  - bearer
            use:
              id: Y5FiB-47DZMc_agIH_b8r
      x-apidog-folder: Account
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-27039797-run
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