# Profile

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/account/profile:
    get:
      summary: Profile
      deprecated: false
      description: >-
        The Login API allows users to authenticate by providing valid
        credentials like username and password. It typically returns an access
        token upon successful authentication.
      tags:
        - Account
      parameters: []
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  message:
                    type: object
                    properties: {}
                    x-apidog-orders: []
                    x-apidog-ignore-properties: []
                  data:
                    type: object
                    properties:
                      displayName:
                        type: string
                        description: User fullname or organiztion name
                      mobile:
                        type: string
                        description: Account owner mobile number
                      verified:
                        type: boolean
                        description: Account verification status
                      blocked:
                        type: boolean
                        description: Account suspention status
                      plan:
                        type: object
                        properties:
                          id:
                            type: integer
                          title:
                            type: string
                          expiryDate:
                            type: string
                        required:
                          - id
                          - title
                        x-apidog-orders:
                          - id
                          - title
                          - expiryDate
                        description: >-
                          Account plan details like name, and expired date (if
                          exists)
                        x-apidog-ignore-properties: []
                      permissions:
                        type: string
                        description: Account permitions ans limitations
                    required:
                      - displayName
                      - mobile
                      - verified
                      - blocked
                      - plan
                      - permissions
                    x-apidog-orders:
                      - displayName
                      - mobile
                      - verified
                      - blocked
                      - plan
                      - permissions
                    x-apidog-ignore-properties: []
                required:
                  - status
                  - message
                  - data
                x-apidog-orders:
                  - status
                  - message
                  - data
                x-apidog-ignore-properties: []
              example:
                status: success
                message: {}
                data:
                  displayName: فراز اس‌ام‌اس
                  mobile: 09XXXXXXXXX
                  verified: true
                  blocked: false
                  plan:
                    id: 1
                    title: اسم پکیج
                    expiryDate: '2025-02-04T15:41:35.000000Z'
                  permissions: 01ffffffffffffffffff
          headers: {}
          x-apidog-name: Success
        '401':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                  data:
                    type: 'null'
                  message:
                    $ref: '#/components/schemas/ApiMessage'
                required:
                  - status
                  - data
                  - message
                x-apidog-orders:
                  - status
                  - data
                  - message
                x-apidog-ignore-properties: []
              example:
                status: error
                data: null
                message: Unauthorized
          headers: {}
          x-apidog-name: Unauthorized
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Account
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13716723-run
components:
  schemas:
    ApiMessage:
      anyOf:
        - type: 'null'
        - type: string
        - type: array
          items:
            type: string
          title: ''
          description: ''
        - type: object
          properties: {}
          x-apidog-orders:
            - 01JK8TSJRZ3DTPBA5E2ZCVQ7A3
          additionalProperties:
            anyOf:
              - type: string
              - type: array
                items:
                  type: string
          minProperties: 1
          title: ''
          description: ''
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

The Login API allows users to authenticate by providing valid credentials like username and password. It typically returns an access token upon successful authentication.
Request
Authorization
Request Code Samples
Responses
🟢200
Success
application/json
status
string 
required
message
object 
required
data
object 
required
displayName
string 
required
User fullname or organiztion name
mobile
string 
required
Account owner mobile number
verified
boolean 
required
Account verification status
blocked
boolean 
required
Account suspention status
plan
object 
required
Account plan details like name, and expired date (if exists)
permissions
string 
required
Account permitions ans limitations
Example
{
    "status": "success",
    "message": {},
    "data": {
        "displayName": "فراز اس‌ام‌اس",
        "mobile": "09XXXXXXXXX",
        "verified": true,
        "blocked": false,
        "plan": {
            "id": 1,
            "title": "اسم پکیج",
            "expiryDate": "2025-02-04T15:41:35.000000Z"
        },
        "permissions": "01ffffffffffffffffff"
    }
}
🟠401
Unauthorized
