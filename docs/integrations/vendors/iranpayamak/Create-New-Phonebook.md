# Create New Phonebook

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/phone_book:
    post:
      summary: Create New Phonebook
      deprecated: false
      description: ''
      tags:
        - Phonebook
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PhonebookCreateRequestDto'
            example: "{\r\n    \"title\": \"test title\",\r\n    \"attributes\": [2] // nullable\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumber'
          headers: {}
          x-apidog-name: Phonebook created successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Phonebook
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13925172-run
components:
  schemas:
    PhonebookCreateRequestDto:
      type: object
      properties:
        title:
          type: string
        attributes:
          type: array
          items:
            type: integer
      required:
        - title
      x-apidog-orders:
        - title
        - attributes
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
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