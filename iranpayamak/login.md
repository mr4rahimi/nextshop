# Login

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/auth/login:
    post:
      summary: Login
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
            example: "{\r\n    \"username\": \"Raya\",\r\n    \"password\": \"1272893596\",\r\n    \"method\": null // nullable, sms | ga\r\n}"
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-24945813-run
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
https://api.iranpayamak.com/ws/v1/auth/login
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
    "username": "Raya",
    "password": "1272893596",
    "method": null // nullable, sms | ga
}
Request Code Samples
Responses
🟢200
Success
application/json
object
 
Example
{}
