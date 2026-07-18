# Verify 2fa

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/auth/verify-2fa:
    post:
      summary: Verify 2fa
      deprecated: false
      description: ''
      tags:
        - Auth
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
              type: object
              properties: {}
            example: "{\r\n    \"token\": \"5GOXRzVeN9FSo8Kco6ngUGgUPBnVYRsa\",\r\n    \"code\": \"264135\",\r\n    \"method\": \"sms\" // nullable, sms | ga\r\n}"
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
      x-apidog-folder: Auth
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-24945819-run
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

POST
https://api.iranpayamak.com/ws/v1/auth/verify-2fa
Request
Authorization
Header Params
Accept
string 
optional
Example:
application/json
Body Params
application/json
object
 
Example
{
    "token": "5GOXRzVeN9FSo8Kco6ngUGgUPBnVYRsa",
    "code": "264135",
    "method": "sms" // nullable, sms | ga
}
Request Code Samples
Responses
🟢200
Success
application/json
object
 
Example
{}
