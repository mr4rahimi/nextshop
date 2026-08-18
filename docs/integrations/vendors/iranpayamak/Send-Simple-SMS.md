# Send Simple SMS

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/simple:
    post:
      summary: Send Simple SMS
      deprecated: false
      description: Send a simple message with one text toward many recipients
      tags:
        - Send/Simple
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
                line_number:
                  type: string
                recipients:
                  type: array
                  items:
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
                  nullable: true
                schedule:
                  type: string
                  nullable: true
              x-apidog-orders:
                - text
                - line_number
                - recipients
                - number_format
                - schedule
              required:
                - text
                - line_number
                - recipients
                - number_format
                - schedule
              x-apidog-ignore-properties: []
            example: "{\r\n    \"text\": \"test text\",\r\n    \"line_number\": \"2191307530\",\r\n    \"recipients\": [\r\n        \"09391155747\"\r\n    ], // array of recipient phone numbers\r\n    \"number_format\": \"english\",\r\n    \"schedule\": \"2026-05-23 12:58:00\" // nullable(chosen time to send)\r\n}"
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
      x-apidog-folder: Send/Simple
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909967-run
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
https://api.iranpayamak.com/ws/v1/sms/simple
Send a simple message with one text toward many recipients
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
text
string 
required
line_number
string 
required
recipients
array[string]
required
number_format
enum<string>  | 
enum<null> 
required
Allowed values:
english
english
persian
persian
schedule
string  | 
null 
required
Example
{
    "text": "test text",
    "line_number": "2191307530",
    "recipients": [
        "09391155747"
    ], // array of recipient phone numbers
    "number_format": "english",
    "schedule": "2026-05-23 12:58:00" // nullable(chosen time to send)
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

const raw = "{\r\n    \"text\": \"test text\",\r\n    \"line_number\": \"2191307530\",\r\n    \"recipients\": [\r\n        \"09391155747\"\r\n    ], // array of recipient phone numbers\r\n    \"number_format\": \"english\",\r\n    \"schedule\": \"2026-05-23 12:58:00\" // nullable(chosen time to send)\r\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/simple", requestOptions)
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
