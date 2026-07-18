# Send Peer-to-Peer SMS from Excel

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/peer-to-peer-file:
    post:
      summary: Send Peer-to-Peer SMS from Excel
      deprecated: false
      description: >-
        Send peer-to-peer messages with file input. Each peer contains different
        text and recipients. Each peer will generate a separate send request
        record.
      tags:
        - Send/Peer-to-Peer
      parameters:
        - name: Accept
          in: header
          description: ''
          required: false
          example:
            - application/json
            - multipart/form-data
          schema:
            type: array
            items:
              type: string
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                line_number:
                  type: string
                  pattern: ^[0-9]+$
                  description: Numeric string representing a valid user line.
                  examples:
                    - '500012345'
                  example: '2191307530'
                peers_file:
                  type: string
                  format: binary
                  description: >-
                    Excel or CSV file containing peer-to-peer message data. Make
                    sure it matches the example structure.
                  example: file:///Users/mehrab/Downloads/peers-sample (3).xlsx
                number_format:
                  type: string
                  enum:
                    - en
                    - fa
                  description: >-
                    When provided, all numbers within the message will be
                    replace with either English or Persian number characters.
                  example: persian
                schedule:
                  type: string
                  format: date-time
                  description: >-
                    When provided, the message will be send at the time of
                    schedule. It must be a future time if provided.
                  example: ''
              required:
                - line_number
                - peers_file
            examples: {}
      responses:
        '201':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultNumberArray'
          headers: {}
          x-apidog-name: All SMS requests are enqueued successfully.
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Send/Peer-to-Peer
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909972-run
components:
  schemas:
    ApiResultNumberArray:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          type: array
          items:
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
https://api.iranpayamak.com/ws/v1/sms/peer-to-peer-file
Send peer-to-peer messages with file input. Each peer contains different text and recipients. Each peer will generate a separate send request record.
Request
Authorization
Header Params
Accept
array[string]
optional
Example:
["application/json","multipart/form-data"]
Body Params multipart/form-data
line_number
string 
required
Numeric string representing a valid user line.
Example:
2191307530
Match pattern:
^[0-9]+$
peers_file
file 
required
Excel or CSV file containing peer-to-peer message data. Make sure it matches the example structure.
Example:
file:///Users/mehrab/Downloads/peers-sample (3).xlsx
number_format
enum<string> 
optional
When provided, all numbers within the message will be replace with either English or Persian number characters.
Allowed values:
en
fa
Example:
persian
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
myHeaders.append("Accept", "multipart/form-data");
myHeaders.append("Api-Key", "<api-key>");

const formdata = new FormData();
formdata.append("line_number", "2191307530");
formdata.append("peers_file", fileInput.files[0], "peers-sample (3).xlsx");
formdata.append("number_format", "persian");
formdata.append("schedule", "");

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: formdata,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/peer-to-peer-file", requestOptions)
   .then((response) => response.text())
   .then((result) => console.log(result))
   .catch((error) => console.error(error));
Responses
🟢201
All SMS requests are enqueued successfully.
application/json
status
enum<string> 
required
Allowed values:
success
error
data
array[number]
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

