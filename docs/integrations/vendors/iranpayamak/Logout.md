# Logout

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/auth/logout:
    post:
      summary: Logout
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
        - bearer: []
      x-apidog-folder: Auth
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-24946032-run
components:
  schemas: {}
  securitySchemes:
    bearer:
      type: http
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
https://api.iranpayamak.com/ws/v1/auth/logout
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
object
 
Example
{}
