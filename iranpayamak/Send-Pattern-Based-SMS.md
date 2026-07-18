# Send Pattern-Based SMS

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/pattern:
    post:
      summary: Send Pattern-Based SMS
      deprecated: false
      description: >-
        Send a pattern-based message, the pattern UID must be creadted and get
        from user panel.
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
              $ref: '#/components/schemas/PatternSendRequestDto'
            example: "{\r\n    \"code\": \"SJ3FgPrE0C\",\r\n    \"attributes\": {\r\n        \"var1\": \"1\",\r\n        \"var2\": \"2\"\r\n    },\r\n    \"recipient\": \"09120000000\",\r\n    \"line_number\": \"50002178584000\",\r\n    \"number_format\": \"english\"\r\n    //, \"schedule\": \"2025-08-20 15:30:00\" // nullable(chosen time to send)\r\n}"
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumber'
          headers: {}
          x-apidog-name: Pattern message sent successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Send
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13925177-run
components:
  schemas:
    PatternSendRequestDto:
      type: object
      properties:
        code:
          type: string
        recipient:
          type: string
          description: 'Like: 09120000000'
        attributes:
          type: array
          items:
            type: object
            description: Mapping of pattern attribute names to their string values.
            additionalProperties:
              type: string
            x-apidog-orders:
              - attributes.0
            properties:
              attributes.0:
                type: string
            x-apidog-ignore-properties: []
        line_number:
          type: string
          pattern: ^[0-9]+$
        number_format:
          type: string
          enum:
            - en
            - fa
          description: english | persian
        schedule:
          type: string
          format: date-time
          description: Maybe it must be null for patterns
      required:
        - code
        - recipient
        - line_number
        - number_format
      x-apidog-orders:
        - code
        - recipient
        - attributes
        - line_number
        - number_format
        - schedule
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
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
https://api.iranpayamak.com/ws/v1/sms/pattern
Send a pattern-based message, the pattern UID must be creadted and get from user panel.
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
code
string 
required
recipient
string 
required
Like: 09120000000
attributes
array [object] 
optional
attributes.0
string 
optional
Additional properties
string 
optional
line_number
string 
required
Match pattern:
^[0-9]+$
number_format
enum<string> 
required
english | persian
Allowed values:
en
fa
schedule
string <date-time>
optional
Maybe it must be null for patterns
Example
{
    "code": "SJ3FgPrE0C",
    "attributes": {
        "var1": "1",
        "var2": "2"
    },
    "recipient": "09120000000",
    "line_number": "50002178584000",
    "number_format": "english"
    //, "schedule": "2025-08-20 15:30:00" // nullable(chosen time to send)
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

const raw = "{\r\n    \"code\": \"SJ3FgPrE0C\",\r\n    \"attributes\": {\r\n        \"var1\": \"1\",\r\n        \"var2\": \"2\"\r\n    },\r\n    \"recipient\": \"09120000000\",\r\n    \"line_number\": \"50002178584000\",\r\n    \"number_format\": \"english\"\r\n    //, \"schedule\": \"2025-08-20 15:30:00\" // nullable(chosen time to send)\r\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/pattern", requestOptions)
   .then((response) => response.text())
   .then((result) => console.log(result))
   .catch((error) => console.error(error));
Responses
🟢201
Pattern message sent successfully.
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

