# Create New Phonebook Attribute

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/phone_book_attribute:
    post:
      summary: Create New Phonebook Attribute
      deprecated: false
      description: Create a new phonebook attribute like birthdate, national code and etc
      tags:
        - Phonebook/Attrebutes
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
              $ref: '#/components/schemas/PhonebookAttributeCreateRequestDto'
            example: "{\r\n    \"title\": \"test attribute\",\r\n    \"type\": \"string\" // date | number | string\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumber'
          headers: {}
          x-apidog-name: Phonebook attribute created successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Phonebook/Attrebutes
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13925174-run
components:
  schemas:
    PhonebookAttributeCreateRequestDto:
      type: object
      properties:
        title:
          type: string
        type:
          type: string
          enum:
            - date
            - number
            - string
      required:
        - title
        - type
      x-apidog-orders:
        - title
        - type
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