# Add Excel Contact

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/phone_book_data/excel-upsert:
    post:
      summary: Add Excel Contact
      deprecated: false
      description: >-
        It used to import contacts to a phonebook with Excel.

        To use with Excel you must get exaple Excel with another existed
        endpoint.

        No limit to import with Excel.
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
          multipart/form-data:
            schema:
              type: object
              properties:
                phone_book_id:
                  type: integer
                  example: 86292
                file:
                  format: binary
                  type: string
                  example: >-
                    cmMtdXBsb2FkLTE3Nzc3MDA2ODEyOTktMg==/updated_excel_file
                    (7).xlsx
            examples: {}
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-34615972-run
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