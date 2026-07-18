# Get Pattern Details

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/patterns/{code}:
    get:
      summary: Get Pattern Details
      deprecated: false
      description: This endpoint help to get a pattern by its "code"
      tags:
        - Patterns
      parameters:
        - name: code
          in: path
          description: ''
          required: true
          schema:
            type: string
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
              $ref: '#/components/schemas/PatternRequestDto'
            example: ''
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-16297027-run
components:
  schemas:
    PatternRequestDto:
      type: object
      properties:
        text:
          type: string
          minLength: 3
        description:
          type: string
        shared:
          type: boolean
        website:
          type: string
          format: uri
        attributes:
          type: array
          items:
            $ref: '#/components/schemas/PatternAttribute'
      required:
        - text
        - shared
        - website
      x-apidog-orders:
        - text
        - description
        - shared
        - website
        - attributes
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    PatternAttribute:
      type: object
      properties:
        length:
          type: integer
        name:
          type: string
          pattern: ^[a-zA-Z_][a-zA-Z0-9_]*$
        type:
          type: string
          enum:
            - integer
            - string
            - date
          default: string
      required:
        - length
        - name
      x-apidog-orders:
        - length
        - name
        - type
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
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