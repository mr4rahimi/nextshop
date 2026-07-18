# Add New Contact

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/phone_book_data:
    post:
      summary: Add New Contact
      deprecated: false
      description: ''
      tags:
        - Phonebook/Contacts
      parameters:
        - name: Accept
          in: header
          description: ''
          required: true
          example: application/json
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
            example: "{\r\n  \"phone_book_id\": 33,\r\n  \"phone_book_data_id\": 1, // needed only when updating mobile\r\n  \"prefix\": \"man\", // man | woman | co | org\r\n  \"mobile\": \"09123456781\",\r\n  \"name\": \"test name\",\r\n  \"attributes\": [\r\n    {\r\n      \"attribute_id\": 5,\r\n      \"value\": \"1378/01/24\"\r\n    },\r\n    {\r\n      \"attribute_id\": 8,\r\n      \"value\": \"Tehran\"\r\n    }\r\n  ]\r\n}"
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
          x-apidog-name: Success
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Phonebook/Contacts
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-23655867-run
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