# Get Bulk Excel Sample

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /example/phone-book/{phone_book}/data.xlsx:
    get:
      summary: Get Bulk Excel Sample
      deprecated: false
      description: >-
        This endpoint used to get an Excel sample file for each phonebook by its
        ID.
      tags:
        - Phonebook/Contacts
      parameters:
        - name: phone_book
          in: path
          description: ''
          required: true
          example: '1'
          schema:
            type: string
        - name: Accept
          in: header
          description: ''
          required: true
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
          x-apidog-name: Success
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Phonebook/Contacts
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-34610017-run
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