# Get Cities List of Provinces

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /cities:
    get:
      summary: Get Cities List of Provinces
      deprecated: false
      description: ''
      tags:
        - GEO
      parameters:
        - name: province_id
          in: query
          description: ''
          required: true
          schema:
            type: string
        - name: has_any_banks
          in: query
          description: If send as TRUE, only banks with at least ONE namber bank returned.
          required: false
          schema:
            type: boolean
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultPagedPhonebook'
          headers: {}
          x-apidog-name: Phonebooks retrieved successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: GEO
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31200787-run
components:
  schemas:
    ApiResultPagedPhonebook:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          $ref: '#/components/schemas/PagedPhonebook'
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
    PagedPhonebook:
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
            $ref: '#/components/schemas/Phonebook'
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
    Phonebook:
      type: object
      properties:
        id:
          type: number
        title:
          type: string
        records:
          type: number
        attributes:
          type: array
          items:
            $ref: '#/components/schemas/PhonebookAttribute'
      required:
        - id
        - title
        - records
        - attributes
      x-apidog-orders:
        - id
        - title
        - records
        - attributes
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    PhonebookAttribute:
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
      required:
        - id
        - title
        - type
        - code
      x-apidog-orders:
        - id
        - title
        - type
        - code
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