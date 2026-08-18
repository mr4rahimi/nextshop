# Get Send Request Items

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/send_request/{send_request_id}/items:
    get:
      summary: Get Send Request Items
      deprecated: false
      description: Get paged list of phonebooks
      tags:
        - Send Requests
      parameters:
        - name: send_request_id
          in: path
          description: ''
          required: true
          example: '407328'
          schema:
            type: string
        - name: search
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: status
          in: query
          description: >-
            not-started | in-queue | sent | send-failure | delivered |
            delivery-failure | delivery-undetermined | system-error | blacklist
          required: false
          example: ''
          schema:
            type: string
        - name: page
          in: query
          description: Page number
          required: false
          schema:
            type: integer
        - name: limit
          in: query
          description: Number of items per page
          required: false
          schema:
            type: integer
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
      x-apidog-folder: Send Requests
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-27724811-run
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