# Send Postal Code SMS

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/calculate-cost:
    post:
      summary: Send Postal Code SMS
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
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                text:
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
                line_id:
                  type: integer
                schedule:
                  type: string
                  format: date-time
                  nullable: true
                filters:
                  type: array
                  items:
                    type: object
                    properties:
                      postal_code:
                        type: string
                        minLength: 100
                        maxLength: 99999
                      gender_id:
                        type: integer
                      age_from:
                        type: integer
                        minimum: 1300
                      age_to:
                        type: integer
                        maximum: 1500
                      number_prefix:
                        type: string
                        examples:
                          - '912'
                        nullable: true
                      operator:
                        type: string
                        enum:
                          - mci
                          - irancell
                          - other
                        x-apidog-enum:
                          - value: mci
                            name: mci
                            description: ''
                          - value: irancell
                            name: irancell
                            description: ''
                          - value: other
                            name: other
                            description: ''
                        nullable: true
                      row_from:
                        type: integer
                      row_count:
                        type: integer
                    x-apidog-orders:
                      - postal_code
                      - gender_id
                      - age_from
                      - age_to
                      - number_prefix
                      - operator
                      - row_from
                      - row_count
                    required:
                      - postal_code
                      - gender_id
                      - age_from
                      - age_to
                      - number_prefix
                      - operator
                      - row_from
                      - row_count
              x-apidog-orders:
                - filters
                - text
                - line_id
                - number_format
                - schedule
              required:
                - text
                - line_id
                - number_format
                - schedule
                - filters
            example: |-
              {
                  "filters": [
                      {
                          "postal_code": "12345", // first [3,4,5] digit of postal code
                          "gender_id": 1,
                          "age_from": 1305,
                          "age_to": 1310,
                          "number_prefix": "912", // nullable
                          "operator": "mci", // mci,irancell,other
                          "row_from": 0,
                          "row_count": 50
                      }
                  ],
                  "text": "message text",
                  "line_id": 12,
                  "number_format": "english",
                  "schedule": "2026-04-01T10:00:00Z"
              }
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31206192-run
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