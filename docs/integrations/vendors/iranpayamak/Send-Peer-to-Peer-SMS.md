# Send Peer-to-Peer SMS

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/sms/peer-to-peer:
    post:
      summary: Send Peer-to-Peer SMS
      deprecated: false
      description: >-
        Send peer-to-peer messages. Each peer contains different text and
        recipients. Each peer will generate a separate send request record.
      tags:
        - Send/Peer-to-Peer
      parameters:
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
        - name: Content-Type
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
                "line_number": "2191307530",
                "number_format": "persian",
                "peers": [
                  {
                    "text": "تست جدید تایید نشه لطفا",
                    "recipients": ["09112176238" , "09203189087"]
                  //   "selectedPhoneBooks": [
                  //     {
                  //       "id": 102904,
                  //       "offset": 0,
                  //       "limit": 3
                  //     }
                  //   ]
                  },
                  {
                    "text": "2 تست جدید تایید نشه لطفا",
                     "recipients": ["09112176238" , "09203189087"],
                  //   "selectedPhoneBooks": [
                  //     {
                  //       "id": 88592,
                  //       "offset": 0,
                  //       "limit": 3
                  //     }
                  //   ]
                  }
                ],
                "schedule": ""
              }
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
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-13909971-run
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
https://api.iranpayamak.com/ws/v1/sms/peer-to-peer
Send peer-to-peer messages. Each peer contains different text and recipients. Each peer will generate a separate send request record.
Request
Authorization
Header Params
Accept
string 
optional
Example:
application/json
Content-Type
string 
optional
Example:
application/json
Body Params
application/json
object
 
Example
{
  "line_number": "2191307530",
  "number_format": "persian",
  "peers": [
    {
      "text": "تست جدید تایید نشه لطفا",
      "recipients": ["09112176238" , "09203189087"]
    //   "selectedPhoneBooks": [
    //     {
    //       "id": 102904,
    //       "offset": 0,
    //       "limit": 3
    //     }
    //   ]
    },
    {
      "text": "2 تست جدید تایید نشه لطفا",
       "recipients": ["09112176238" , "09203189087"],
    //   "selectedPhoneBooks": [
    //     {
    //       "id": 88592,
    //       "offset": 0,
    //       "limit": 3
    //     }
    //   ]
    }
  ],
  "schedule": ""
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

const raw = "{\n  \"line_number\": \"2191307530\",\n  \"number_format\": \"persian\",\n  \"peers\": [\n    {\n      \"text\": \"تست جدید تایید نشه لطفا\",\n      \"recipients\": [\"09112176238\" , \"09203189087\"]\n    //   \"selectedPhoneBooks\": [\n    //     {\n    //       \"id\": 102904,\n    //       \"offset\": 0,\n    //       \"limit\": 3\n    //     }\n    //   ]\n    },\n    {\n      \"text\": \"2 تست جدید تایید نشه لطفا\",\n       \"recipients\": [\"09112176238\" , \"09203189087\"],\n    //   \"selectedPhoneBooks\": [\n    //     {\n    //       \"id\": 88592,\n    //       \"offset\": 0,\n    //       \"limit\": 3\n    //     }\n    //   ]\n    }\n  ],\n  \"schedule\": \"\"\n}";

const requestOptions = {
   method: "POST",
   headers: myHeaders,
   body: raw,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/sms/peer-to-peer", requestOptions)
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

