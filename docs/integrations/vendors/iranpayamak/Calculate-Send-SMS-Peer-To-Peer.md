# Calculate Send SMS Peer To Peer

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/calculate-cost/peer-to-peer:
    post:
      summary: Calculate Send SMS Peer To Peer
      deprecated: false
      description: |-
        This API used for calculate cost for this SMS Type:
        Simple | Sample | PostalCode | Pattern
      tags:
        - Send
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
          application/json:
            schema:
              type: object
              properties:
                text:
                  type: string
                receiver_count:
                  type: integer
                line_number:
                  type: string
                number_format:
                  type: string
                  enum:
                    - english
                    - persian
                  x-apidog-enum:
                    - value: english
                      name: english
                      description: ''
                    - value: persian
                      name: persian
                      description: ''
              x-apidog-orders:
                - text
                - receiver_count
                - line_number
                - number_format
              required:
                - text
                - receiver_count
                - line_number
                - number_format
            example:
              line_number: '2191307530'
              number_format: persian
              peers:
                - text: متن پیام اول
                  receiver_count: 3
                - text: متن پیام دوم
                  receiver_count: 1
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
      x-apidog-folder: Send
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-40276691-run
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