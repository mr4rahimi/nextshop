# Get Phonebook Contacts

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/phone_book_data:
    get:
      summary: Get Phonebook Contacts
      deprecated: false
      description: Get paged phonebook data for a specific phonebook
      tags:
        - Phonebook/Contacts
      parameters:
        - name: page
          in: query
          description: Page number
          required: false
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          description: Number of items per page
          required: false
          schema:
            type: integer
            minimum: 1
            default: 10
        - name: phone_book_id
          in: query
          description: The phonebook Id
          required: false
          example: 1
          schema:
            type: integer
        - name: search
          in: query
          description: Search parameter
          required: false
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultPagedPhonebookData'
          headers: {}
          x-apidog-name: Phonebook data retrieved successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Phonebook/Contacts
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13925175-run
components:
  schemas:
    ApiResultPagedPhonebookData:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          $ref: '#/components/schemas/PagedPhonebookData'
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
    PagedPhonebookData:
      type: object
      properties:
        currentPage:
          type: number
        totalPages:
          type: number
        totalItems:
          type: number
        itemsPerPage:
          type: number
        items:
          type: array
          items:
            $ref: '#/components/schemas/PhonebookDataRecord'
      required:
        - currentPage
        - totalPages
        - totalItems
        - itemsPerPage
        - items
      x-apidog-orders:
        - currentPage
        - totalPages
        - totalItems
        - itemsPerPage
        - items
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    PhonebookDataRecord:
      type: object
      properties:
        id:
          type: number
        prefix:
          type: string
          enum:
            - man
            - woman
            - co
            - org
          nullable: true
        name:
          type: string
          nullable: true
        mobile:
          type: string
          pattern: ^09\d{9}$
        attributes:
          type: array
          items:
            $ref: '#/components/schemas/PhonebookDataAttribute'
      required:
        - id
        - prefix
        - name
        - mobile
        - attributes
      x-apidog-orders:
        - id
        - prefix
        - name
        - mobile
        - attributes
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    PhonebookDataAttribute:
      type: object
      properties:
        id:
          type: number
        title:
          type: string
        type:
          type: string
          enum:
            - date
            - number
            - string
        code:
          type: string
        value:
          oneOf:
            - type: string
            - type: number
          type: 'null'
      required:
        - id
        - title
        - type
        - code
        - value
      x-apidog-orders:
        - id
        - title
        - type
        - code
        - value
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