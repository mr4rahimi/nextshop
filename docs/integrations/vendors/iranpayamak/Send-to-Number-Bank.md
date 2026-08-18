# Send to Number Bank

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/bank:
    post:
      summary: Send to Number Bank
      deprecated: false
      description: ''
      tags:
        - 'Send/NumberBank '
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
              properties:
                text:
                  type: string
                recipients:
                  type: array
                  items:
                    type: object
                    properties:
                      bank_id:
                        type: integer
                      limit:
                        type: integer
                      offset:
                        type: integer
                    x-apidog-orders:
                      - bank_id
                      - limit
                      - offset
                    required:
                      - bank_id
                      - limit
                      - offset
                    x-apidog-ignore-properties: []
                line_number:
                  type: string
                number_format:
                  type: string
                  enum:
                    - english
                    - persian
                  x-apidog-enum:
                    - value: english
                      name: english
                      description: ''
                    - value: persian
                      name: persian
                      description: ''
                schedule:
                  type: string
                  nullable: true
              x-apidog-orders:
                - text
                - recipients
                - line_number
                - number_format
                - schedule
              required:
                - text
                - line_number
                - number_format
              x-apidog-ignore-properties: []
            example: "{\r\n    \"text\": \"test message\",\r\n    \"recipients\": [\r\n        {\r\n            \"bank_id\": 1,\r\n            \"limit\": 50,\r\n            \"offset\": 0\r\n        },\r\n        {\r\n            \"bank_id\": 5,\r\n            \"limit\": 100,\r\n            \"offset\": 50\r\n        }\r\n    ],\r\n    \"line_number\": \"98123123\",\r\n    \"number_format\": \"english\",\r\n    \"schedule\": \"2026-03-20T10:00:00Z\" // nullable(chosen time to send)\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumber'
          headers: {}
          x-apidog-name: SMS request is enqueued successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: 'Send/NumberBank '
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31283521-run
components:
  schemas:
    ApiResultNumber:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          type: number
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

POST
https://api.iranpayamak.com/ws/v1/sms/bank
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
Required
text
string 
required
recipients
array [object] 
optional
bank_id
integer 
required
limit
integer 
required
offset
integer 
required
line_number
string 
required
number_format
enum<string> 
required
Allowed values:
english
english
persian
persian
schedule
string  | 
null 
optional
Example
{
    "text": "test message",
    "recipients": [
        {
            "bank_id": 1,
            "limit": 50,
            "offset": 0
        },
        {
            "bank_id": 5,
            "limit": 100,
            "offset": 50
        }
    ],
    "line_number": "98123123",
    "number_format": "english",
    "schedule": "2026-03-20T10:00:00Z" // nullable(chosen time to send)
}
Request Code Samples
Fetch
Axios
jQuery
XHR
Native
Request
Unirest
const myHeaders = new Headers();
myHeaders.append("Accept", "application/json");
myHeaders.append("Api-Key", "<api-key>");
myHeaders.append("Content-Type", "application/json");

const raw = "{\r\n    \"text\": \"test message\",\r\n    \"recipients\": [\r\n        {\r\n            \"bank_id\": 1,\r\n            \"limit\": 50,\r\n            \"offset\": 0\r\n        },\r\n        {\r\n            \"bank_id\": 5,\r\n            \"limit\": 100,\r\n            \"offset\": 50\r\n        }\r\n    ],\r\n    \"line_number\": \"98123123\",\r\n    \"number_format\": \"english\",\r\n    \"schedule\": \"2026-03-20T10:00:00Z\" // nullable(chosen time to send)\r\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/bank", requestOptions)
   .then((response) => response.text())
   .then((result) => console.log(result))
   .catch((error) => console.error(error));
Responses
🟢201
SMS request is enqueued successfully.
application/json
status
enum<string> 
required
Allowed values:
success
error
data
number 
required
messages
required
One of:

allOf

allOf

allOf
One of:

null

string

Example
{
    "status": "success",
    "data": 0,
    "messages": "string"
}
