# Edit LBS Request

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/lbs/{lbsId}:
    put:
      summary: Edit LBS Request
      deprecated: false
      description: ''
      tags:
        - Send/LBS
      parameters:
        - name: lbsId
          in: path
          description: ''
          required: true
          example: '5'
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
              type: object
              properties: {}
              x-apidog-orders: []
            example: "{\r\n    \"text\": \"test text\",\r\n    \"start_time\": 1742773823,\r\n    \"end_time\": 1742774823,\r\n    \"receiver_count\": 10000,\r\n    \"latitude\": 45,\r\n    \"longitude\": 90,\r\n    \"radius\": 1000,\r\n    \"address\": \"some address\",\r\n    \"dispatch_moment\": \"حضور\", // 'ورود', 'حضور', 'خروج'\r\n    \"receiver_gender\": \"مرد\", // 'همه', 'مرد', 'زن'\r\n    \"receiver_age_from\": 12,\r\n    \"receiver_age_to\": 90,\r\n    \"device\": \"Android\", // 'همه', 'Android', 'IOS'\r\n}"
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
          x-apidog-name: ''
      security:
        - bearer: []
          x-apidog:
            required: true
            schemeGroups:
              - id: wOw_MDv1_uOmvvCPwwv92
                schemeIds:
                  - bearer
            use:
              id: wOw_MDv1_uOmvvCPwwv92
      x-apidog-folder: Send/LBS
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-25851393-run
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