# Show Single LBS Request Details

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/lbs/{lbsId}:
    get:
      summary: Show Single LBS Request Details
      deprecated: false
      description: ''
      tags:
        - Send/LBS
      parameters:
        - name: lbsId
          in: path
          description: ''
          required: true
          example: '1'
          schema:
            type: string
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
        - bearer: []
          x-apidog:
            required: true
            schemeGroups:
              - id: oOoEM0tFmpyjk38Us2Lrq
                schemeIds:
                  - bearer
            use:
              id: oOoEM0tFmpyjk38Us2Lrq
      x-apidog-folder: Send/LBS
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-25851392-run
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