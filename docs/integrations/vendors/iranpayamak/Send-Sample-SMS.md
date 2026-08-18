# Send Sample SMS

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/sample:
    post:
      summary: Send Sample SMS
      deprecated: false
      description: Send a sample of message to the account owner
      tags:
        - Send
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
              x-apidog-orders: []
              x-apidog-ignore-properties: []
            example: |-
              {
                  "text": "test text",
                  "line_number": "50002178584000",
                  "number_format": "english",
                  //"schedule": "2025-08-20 15:30:00", // nullable(chosen time to send)
              }
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
      x-apidog-folder: Send
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909966-run
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
https://api.iranpayamak.com/ws/v1/sms/sample
Send a sample of message to the account owner
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
    "text": "test text",
    "line_number": "50002178584000",
    "number_format": "english",
    //"schedule": "2025-08-20 15:30:00", // nullable(chosen time to send)
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

const raw = "{\n    \"text\": \"test text\",\n    \"line_number\": \"50002178584000\",\n    \"number_format\": \"english\",\n    //\"schedule\": \"2025-08-20 15:30:00\", // nullable(chosen time to send)\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/sample", requestOptions)
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

