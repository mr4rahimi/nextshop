# Send SMS with Variables from Excel

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/send/keyword-file:
    post:
      summary: Send SMS with Variables from Excel
      deprecated: false
      description: >-
        Send a message with keywords with its data coming from an excel or CSV
        file. The keywords (attributes) must be wrapped inside % signs within
        the text (E.g: Hello %first_name%)
      tags:
        - Send/Variable-Based
      parameters: []
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                text:
                  type: string
                  minLength: 3
                  example: ''
                from:
                  type: string
                  pattern: ^[0-9]+$
                  description: The line number which is used to send the SMS.
                  examples:
                    - '500012345'
                  example: '500012345'
                recipients:
                  type: string
                  format: binary
                  description: >-
                    Excel or CSV file containing recipient data. Make sure it
                    matches the example structure.
                  example: ''
                numberFormat:
                  type: string
                  enum:
                    - en
                    - fa
                  description: >-
                    When provided, all numbers within the message will be
                    replace with either English or Persian number characters.
                  example: ''
                schedule:
                  type: string
                  format: date-time
                  description: >-
                    When provided, the message will be send at the time of
                    schedule. It must be a future time if provided.
                  example: ''
              required:
                - text
                - from
                - recipients
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909970-run
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
https://api.iranpayamak.com/v1/send/keyword-file
Send a message with keywords with its data coming from an excel or CSV file. The keywords (attributes) must be wrapped inside % signs within the text (E.g: Hello %first_name%)
Request
Authorization
Body Params multipart/form-data
text
string 
required
>= 3 characters
from
string 
required
The line number which is used to send the SMS.
Example:
500012345
Match pattern:
^[0-9]+$
recipients
file 
required
Excel or CSV file containing recipient data. Make sure it matches the example structure.
numberFormat
enum<string> 
optional
When provided, all numbers within the message will be replace with either English or Persian number characters.
Allowed values:
en
fa
schedule
string <date-time>
optional
When provided, the message will be send at the time of schedule. It must be a future time if provided.
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

const formdata = new FormData();
formdata.append("text", "");
formdata.append("from", "500012345");
formdata.append("recipients", fileInput.files[0], "");
formdata.append("numberFormat", "");
formdata.append("schedule", "");

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: formdata,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/v1/send/keyword-file", requestOptions)
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

