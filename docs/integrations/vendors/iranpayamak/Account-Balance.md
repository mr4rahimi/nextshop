# Account Balance

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/account/balance:
    get:
      summary: Account Balance
      deprecated: false
      description: ''
      tags:
        - Account
      parameters:
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
                type: object
                properties:
                  status:
                    $ref: '#/components/schemas/ApiStatus'
                  message: &ref_0
                    $ref: '#/components/schemas/ApiMessage'
                  data:
                    type: object
                    properties:
                      balanceAmount:
                        type: integer
                      balanceCount:
                        type: integer
                      details:
                        type: array
                        items:
                          type: object
                          properties:
                            count:
                              type: integer
                              description: تعداد پیامک
                            rate:
                              type: integer
                              description: تعرفه پیامک
                            amount:
                              type: integer
                              description: موجودی تومانی
                          required:
                            - count
                            - rate
                            - amount
                          x-apidog-orders:
                            - count
                            - rate
                            - amount
                          x-apidog-ignore-properties: []
                    required:
                      - balanceAmount
                      - balanceCount
                      - details
                    x-apidog-orders:
                      - balanceAmount
                      - balanceCount
                      - details
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
                message: null
                data:
                  balanceAmount: 5000
                  balanceCount: 25
                  details:
                    - count: 25
                      rate: 200
                      amount: 5000
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
                  message: *ref_0
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13717911-run
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
    ApiStatus:
      type: string
      enum:
        - success
        - error
      x-apidog-enum:
        - value: success
          name: ''
          description: ''
        - value: error
          name: ''
          description: ''
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

GET
https://api.iranpayamak.com/ws/v1/account/balance
Request
Authorization
Header Params
Accept
string 
optional
Example:
application/json
Request Code Samples
Responses
🟢200
Success
application/json
status
enum<string> 
(ApiStatus)
ApiStatus
required
Allowed values:
success
error
message
(ApiMessage)
ApiMessage
required
Any of:

null

string

array[string]

object
data
object 
required
balanceAmount
integer 
required
balanceCount
integer 
required
details
array [object] 
required
Example
{
    "status": "success",
    "message": null,
    "data": {
        "balanceAmount": 5000,
        "balanceCount": 25,
        "details": [
            {
                "count": 25,
                "rate": 200,
                "amount": 5000
            }
        ]
    }
}
🟠401
Unauthorized