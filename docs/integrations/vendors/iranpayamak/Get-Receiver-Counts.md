# Get Receiver Counts

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/postal/get-receiver-count:
    get:
      summary: Get Receiver Counts
      deprecated: false
      description: ''
      tags:
        - Send/PostalCode
      parameters:
        - name: postal_code
          in: query
          description: First [3,4,5] digit of postal code
          required: true
          schema:
            type: string
            minLength: 100
            maxLength: 99999
        - name: gender_id
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: age_from
          in: query
          description: ''
          required: true
          example: '1300'
          schema:
            type: string
            default: '1300'
        - name: age_to
          in: query
          description: ''
          required: true
          example: '1400'
          schema:
            type: string
            default: '1400'
        - name: number_prefix
          in: query
          description: ''
          required: false
          example: '912'
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
      security: []
      x-apidog-folder: Send/PostalCode
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31205984-run
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