# Send Simple SMS from Excel

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/simple-file:
    post:
      summary: Send Simple SMS from Excel
      deprecated: false
      description: Send a simple message with recipients from excel file.
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
          multipart/form-data:
            schema:
              type: object
              properties:
                text:
                  type: string
                  minLength: 3
                  example: test text
                line_number:
                  type: string
                  pattern: ^[0-9]+$
                  description: The line number which is used to send the SMS.
                  examples:
                    - '500012345'
                  example: '50002178584000'
                recipients_file:
                  type: string
                  format: binary
                  description: >-
                    Excel or CSV file containing recipient phone numbers. Make
                    sure it matches the example structure.
                  example: >-
                    cmMtdXBsb2FkLTE3NTYzODEzNTcxMzctNQ==/New Microsoft Excel
                    Worksheet.xlsx
                number_format:
                  type: string
                  enum:
                    - en
                    - fa
                  description: >-
                    When provided, all numbers within the message will be
                    replace with either English or Persian number characters.
                  example: english
                schedule:
                  type: string
                  format: date-time
                  description: >-
                    When provided, the message will be send at the time of
                    schedule. It must be a future time if provided.
                  example: ''
              required:
                - text
                - line_number
                - recipients_file
            examples: {}
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909968-run
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
https://api.iranpayamak.com/ws/v1/sms/simple-file
Send a simple message with recipients from excel file.
Request
Authorization
Header Params
Accept
string 
optional
Example:
application/json
Body Params multipart/form-data
text
string 
required
>= 3 characters
Example:
test text
line_number
string 
required
The line number which is used to send the SMS.
Example:
50002178584000
Match pattern:
^[0-9]+$
recipients_file
file 
required
Excel or CSV file containing recipient phone numbers. Make sure it matches the example structure.
Example:
cmMtdXBsb2FkLTE3NTYzODEzNTcxMzctNQ==/New Microsoft Excel Worksheet.xlsx
number_format
enum<string> 
optional
When provided, all numbers within the message will be replace with either English or Persian number characters.
Allowed values:
en
fa
Example:
english
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
myHeaders.append("Accept", "application/json");
myHeaders.append("Api-Key", "<api-key>");

const formdata = new FormData();
formdata.append("text", "test text");
formdata.append("line_number", "50002178584000");
formdata.append("recipients_file", fileInput.files[0], "New Microsoft Excel Worksheet.xlsx");
formdata.append("number_format", "english");

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: formdata,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/simple-file", requestOptions)
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

