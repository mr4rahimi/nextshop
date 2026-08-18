# Get List of Avalibale Banks

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/number_bank:
    get:
      summary: Get List of Avalibale Banks
      deprecated: false
      description: ''
      tags:
        - 'Send/NumberBank '
      parameters:
        - name: province_id
          in: query
          description: ''
          required: true
          schema:
            type: integer
        - name: city_id
          in: query
          description: ''
          required: true
          schema:
            type: integer
        - name: search
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: include_public_banks
          in: query
          description: If send as TRUE, IranPyamak public number bank returned too
          required: false
          schema:
            type: boolean
        - name: Accept
          in: header
          description: ''
          required: false
          example: application/json
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResultPagedPhonebook'
          headers: {}
          x-apidog-name: Phonebooks retrieved successfully.
      security: []
      x-apidog-folder: 'Send/NumberBank '
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-31200901-run
components:
  schemas:
    ApiResultPagedPhonebook:
      type: object
      properties:
        status:
          type: string
          enum:
            - success
            - error
        data:
          $ref: '#/components/schemas/PagedPhonebook'
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
    PagedPhonebook:
      type: object
      properties:
        currentPage:
          type: number
        totalPages:
          type: number
        totalItems:
          type: number
        itemsPerPage:
          type: number
        items:
          type: array
          items:
            $ref: '#/components/schemas/Phonebook'
      required:
        - currentPage
        - totalPages
        - totalItems
        - itemsPerPage
        - items
      x-apidog-orders:
        - currentPage
        - totalPages
        - totalItems
        - itemsPerPage
        - items
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    Phonebook:
      type: object
      properties:
        id:
          type: number
        title:
          type: string
        records:
          type: number
        attributes:
          type: array
          items:
            $ref: '#/components/schemas/PhonebookAttribute'
      required:
        - id
        - title
        - records
        - attributes
      x-apidog-orders:
        - id
        - title
        - records
        - attributes
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    PhonebookAttribute:
      type: object
      properties:
        id:
          type: number
        title:
          type: string
        type:
          type: string
          enum:
            - date
            - number
            - string
        code:
          type: string
      required:
        - id
        - title
        - type
        - code
      x-apidog-orders:
        - id
        - title
        - type
        - code
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

GET
https://api.iranpayamak.com/ws/v1/number_bank
Request
Authorization
Query Params
province_id
integer 
required
city_id
integer 
required
search
string 
optional
include_public_banks
boolean 
optional
If send as TRUE, IranPyamak public number bank returned too
Header Params
Accept
string 
optional
Example:
application/json
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

const requestOptions = {
   method: "GET",
   headers: myHeaders,
   redirect: "follow"
};

fetch("https://api.iranpayamak.com/ws/v1/number_bank?province_id&city_id&search&include_public_banks", requestOptions)
   .then((response) => response.text())
   .then((result) => console.log(result))
   .catch((error) => console.error(error));
Responses
🟢200
Phonebooks retrieved successfully.
application/json
status
enum<string> 
required
Allowed values:
success
error
data
object 
(PagedPhonebook)
PagedPhonebook
required
currentPage
number 
required
totalPages
number 
required
totalItems
number 
required
itemsPerPage
number 
required
items
array[object (Phonebook)] 
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

