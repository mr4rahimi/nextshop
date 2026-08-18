# Send SMS with Variables

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/keywords:
    post:
      summary: Send SMS with Variables
      deprecated: false
      description: >-
        Send a message containing variable keywords. The keywords (attributes)
        must be wrapped inside % signs within the text (E.g: Hello %first_name%)
      tags:
        - Send/Variable-Based
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties: {}
              x-apidog-orders: []
              x-apidog-ignore-properties: []
            example: "{\r\n    \"text\": \"test %var1% text\",\r\n    \"line_number\": \"50002178584000\",\r\n    \"recipients\": [\r\n        {\r\n            \"mobile\": \"09120000000\",\r\n            \"var1\": \"value1\"\r\n        },\r\n        {\r\n            \"mobile\": \"09130000000\",\r\n            \"var1\": \"value2\"\r\n        }\r\n    ], // array of recipient phone numbers + vars\r\n    \"number_format\": \"english\",\r\n    // \"schedule\": \"2025-08-20 15:30:00\", // nullable(chosen time to send)\r\n}"
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
      x-apidog-folder: Send/Variable-Based
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909969-run
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
https://api.iranpayamak.com/ws/v1/sms/keywords
Send a message containing variable keywords. The keywords (attributes) must be wrapped inside % signs within the text (E.g: Hello %first_name%)
Request
Authorization
Body Params
application/json
object
 
Example
{
    "text": "test %var1% text",
    "line_number": "50002178584000",
    "recipients": [
        {
            "mobile": "09120000000",
            "var1": "value1"
        },
        {
            "mobile": "09130000000",
            "var1": "value2"
        }
    ], // array of recipient phone numbers + vars
    "number_format": "english",
    // "schedule": "2025-08-20 15:30:00", // nullable(chosen time to send)
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
myHeaders.append("Api-Key", "<api-key>");
myHeaders.append("Content-Type", "application/json");

const raw = "{\r\n    \"text\": \"test %var1% text\",\r\n    \"line_number\": \"50002178584000\",\r\n    \"recipients\": [\r\n        {\r\n            \"mobile\": \"09120000000\",\r\n            \"var1\": \"value1\"\r\n        },\r\n        {\r\n            \"mobile\": \"09130000000\",\r\n            \"var1\": \"value2\"\r\n        }\r\n    ], // array of recipient phone numbers + vars\r\n    \"number_format\": \"english\",\r\n    // \"schedule\": \"2025-08-20 15:30:00\", // nullable(chosen time to send)\r\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/keywords", requestOptions)
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

