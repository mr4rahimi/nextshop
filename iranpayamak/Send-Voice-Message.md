# Send Voice Message

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/voice/send:
    post:
      summary: Send Voice Message
      deprecated: false
      description: >-
        Send a Voice message toward many recipients.

        You must use at least one of the attrebute {recipients} or
        {selectedPhoneBooks}.
      tags:
        - Send/VoiceMessage
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
                file_id:
                  type: integer
                recipients:
                  type: array
                  items:
                    type: string
                    examples:
                      - '09120000000'
                selectedPhoneBooks:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                      offset:
                        type: integer
                      limit:
                        type: integer
                    x-apidog-orders:
                      - id
                      - offset
                      - limit
                    required:
                      - id
                      - offset
                      - limit
                    x-apidog-ignore-properties: []
                schedule:
                  type: string
                  nullable: true
              x-apidog-orders:
                - file_id
                - recipients
                - selectedPhoneBooks
                - schedule
              required:
                - file_id
              x-apidog-ignore-properties: []
            example: "{\r\n    \"file_id\": 1,\r\n    \"recipients\": [\r\n        \"09120000000\"\r\n    ],\r\n    \"selectedPhoneBooks\": [\r\n        {\r\n            \"id\": 1,\r\n            \"offset\": 0,\r\n            \"limit\": 10\r\n        }\r\n    ],\r\n    \"schedule\": \"2025-08-20 15:30:00\" // nullable(chosen time to send)\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumber'
          headers: {}
          x-apidog-name: SMS request is enqueued successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Send/VoiceMessage
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31200965-run
components:
  schemas:
    ApiResultNumber:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          type: number
        messages:
          oneOf:
            - type: string
            - type: array
              items:
                type: string
            - type: object
              additionalProperties:
                oneOf:
                  - type: string
                  - type: array
                    items:
                      type: string
              x-apidog-orders: []
              properties: {}
              x-apidog-ignore-properties: []
          type: 'null'
      required:
        - status
        - data
        - messages
      x-apidog-orders:
        - status
        - data
        - messages
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
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