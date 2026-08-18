# Create New Pattern

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/patterns:
    post:
      summary: Create New Pattern
      deprecated: false
      description: Create a new pattern with API
      tags:
        - Patterns
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
                description:
                  description: nullable
                  type: string
                share:
                  description: boolean
                  type: integer
                website:
                  type: string
                category:
                  description: 1 = otp, 2 = club, 3 = order, 255 = others
                  type: integer
                vars:
                  type: array
                  items:
                    type: object
                    properties:
                      var:
                        type: string
                      length:
                        type: integer
                      type:
                        description: int, str, date
                        type: string
                    required:
                      - var
                      - length
                      - type
                    x-apidog-orders:
                      - var
                      - length
                      - type
                    x-apidog-ignore-properties: []
              required:
                - text
                - description
                - share
                - website
                - category
                - vars
              x-apidog-orders:
                - text
                - description
                - share
                - website
                - category
                - vars
              x-apidog-ignore-properties: []
            example: "{\r\n    \"text\": \"test text %var%, %var2%\",\r\n    \"description\": \"test desc\", // nullable\r\n    \"share\": 1, // boolean\r\n    \"website\": \"example.com\",\r\n    \"category\": 1, // 1 = otp, 2 = club, 3 = order, 255 = others\r\n    \"vars\": [\r\n        {\r\n            \"var\": \"var\",\r\n            \"length\": 12,\r\n            \"type\": \"int\" // int, str, date\r\n        },\r\n        {\r\n            \"var\": \"var2\",\r\n            \"length\": 12,\r\n            \"type\": \"int\" // int, str, date\r\n        }\r\n    ]\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultString'
          headers: {}
          x-apidog-name: Pattern created successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Patterns
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13925176-run
components:
  schemas:
    ApiResultString:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          type: string
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