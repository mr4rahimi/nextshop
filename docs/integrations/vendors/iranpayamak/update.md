# update

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /ws/v1/account/update:
    post:
      summary: update
      deprecated: false
      description: ''
      tags:
        - Account
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
            example: "{\r\n    \"first_name\": \"Ali\",\r\n    \"last_name\": \"Rezaei\",\r\n    \"father_name\": \"Mohammad\",\r\n    \"gender\": 1, // 1 = men, 2 = women, 3 = other\r\n    \"national_code\": \"1234567890\",\r\n    \"national_id\": \"A123456789\",\r\n    \"br_date\": 631152000, // Example UNIX timestamp (1990-01-01)\r\n    \"live_province_id\": 2,\r\n    \"live_city_id\": 20,\r\n    \"live_postal_code\": \"1234567890\",\r\n    \"fixed_phone\": \"02112345678\",\r\n    \"mobile\": \"09121234567\",\r\n    \"email\": \"ali.rezaei@example.com\",\r\n    \"address\": \"123 Example St, Cityname\",\r\n    \"ceo\": {\r\n        \"has_ceo\": true,\r\n        \"first_name\": \"Sara\",\r\n        \"last_name\": \"Ahmadi\",\r\n        \"father_name\": \"Hossein\",\r\n        \"gender\": 1, // 1 = men, 2 = women, 3 = other\r\n        \"br_date\": 599616000, // 1989-01-01\r\n        \"mobile\": \"09351234567\",\r\n        \"national_id\": \"B987654321\",\r\n        \"national_code\": \"9876543210\"\r\n    },\r\n    \"company\": {\r\n        \"name\": \"Example Co\",\r\n        \"national_id\": \"1122334455\",\r\n        \"registration_id\": \"778899\",\r\n        \"economic_id\": \"6655443322\",\r\n        \"province_id\": 3,\r\n        \"city_id\": 30,\r\n        \"address\": \"456 Corporate Ave, Business City\",\r\n        \"postal_code\": \"4433221100\",\r\n        \"fixed_phone\": \"02187654321\",\r\n        \"email\": \"info@exampleco.com\"\r\n    }\r\n}"
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties: {}
                x-apidog-orders: []
          headers: {}
          x-apidog-name: OK
      security:
        - apikey-header-Api-Key: []
      x-apidog-folder: Account
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/805827/apis/api-22119667-run
components:
  schemas: {}
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
https://api.iranpayamak.com/ws/v1/account/update
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
    "first_name": "Ali",
    "last_name": "Rezaei",
    "father_name": "Mohammad",
    "gender": 1, // 1 = men, 2 = women, 3 = other
    "national_code": "1234567890",
    "national_id": "A123456789",
    "br_date": 631152000, // Example UNIX timestamp (1990-01-01)
    "live_province_id": 2,
    "live_city_id": 20,
    "live_postal_code": "1234567890",
    "fixed_phone": "02112345678",
    "mobile": "09121234567",
    "email": "ali.rezaei@example.com",
    "address": "123 Example St, Cityname",
    "ceo": {
        "has_ceo": true,
        "first_name": "Sara",
        "last_name": "Ahmadi",
        "father_name": "Hossein",
        "gender": 1, // 1 = men, 2 = women, 3 = other
        "br_date": 599616000, // 1989-01-01
        "mobile": "09351234567",
        "national_id": "B987654321",
        "national_code": "9876543210"
    },
    "company": {
        "name": "Example Co",
        "national_id": "1122334455",
        "registration_id": "778899",
        "economic_id": "6655443322",
        "province_id": 3,
        "city_id": 30,
        "address": "456 Corporate Ave, Business City",
        "postal_code": "4433221100",
        "fixed_phone": "02187654321",
        "email": "info@exampleco.com"
    }
}
Request Code Samples
Responses
🟢200
OK
