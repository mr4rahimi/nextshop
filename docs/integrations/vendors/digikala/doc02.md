خروجی کامل صفحه مستندات در:
/home/mehdi/Projects/nextshop/docs/integrations/vendors/digikala/Digikala.html


Swagger UI
Explore
DK Marketplace - Open API Service

 1.0.0 

OAS3

/open-api/v1/doc/specification.yml

This project is an enhancement of the Digikala Marketplace API. Its main goal is providing an API-based solution for Developers useful for implementing new Applications To improve Digikala Sellers Business.
To use these APIs, you must have an 'Active Client' registered in Digikala. If you don't, You can use the Sandbox (with Mock Data) to develop your Application.
For More Information (Client Registration, Issues, Bugs and suggestions), please contact us.
API count: 289
Contact the developer
Servers
Authorize
Health-check (1)
GET
​/open-api​/v1​/

Return service details and settings.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

Undefined
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Authentication (5)
GET
​/open-api​/v1​/auth​/scopes

List of Scopes.
This API shows all scopes that are defined in this service and can be used, but it does NOT mean it is available for your application.
If you don't have a scope and your application need it, contact the support team for it
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ScopeListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "key": "variant",
        "title": "مدیریت تنوع و قیمت‌گذاری",
        "description": "امکان مشاهده و ویرایش اطلاعات مدیریت تنوع و قیمت‌گذاری پنل شما را خواهد داشت",
        "access": "write"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/auth​/scopes​/{client_code}

List of available Scopes for your Application. This API return a list of scopes that your application is allowed to use
Parameters
Try it out
Name	Description
client_code *
string
(path)
	

your Application identifier
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ClientAvailableScopeListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "key": "variant",
        "title": "مدیریت تنوع و قیمت‌گذاری",
        "description": "امکان مشاهده و ویرایش اطلاعات مدیریت تنوع و قیمت‌گذاری پنل شما را خواهد داشت",
        "access": "write"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/auth​/token

Generate Access and Refresh Token.
After seller confirmed your application access, will be redirected back to your application with an authorization_code. you should decrypt the code and use it in this route to activate your access to seller resource
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "authorization_code": "hH23dac@sadaflFdffa/sdDasAdoNQqwdsad12312rf459sa"
}

Responses
Code	Description	Links
200	

ClientCreateTokenForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "access_token": "eyJ0eXSiOiJKV1QiLCJjbGciOiJIUzM5nCJ9.eyJ0b2tlbl9pZCI6OSwiY2xZZW59X2NvZGUiOiJWdk9aNUxaNkx6dWVWTHFIVEY4TCIsImV4cCI6MTcyMzU4NDg1N30.QSU8llz4AwJTH-EJnPW4GQMfjnAu0m8Nh3sM9kkSIx_sCdm6rO8VeT5uVHU69reF",
    "refresh_token": "WQ098gF5PG3salmqewqvfbgxzzgTgAmWvkrQaWkgnpiqky1KAoqnxunQBz09Xc5UI1eg9tSo1h6k1",
    "access_token_expires_at": {
      "date": "2025-02-07 00:00:00.000000",
      "timezone_type": 3,
      "timezone": "Asia/Tehran"
    },
    "refresh_token_expires_at": {
      "date": "2025-02-07 00:00:00.000000",
      "timezone_type": 3,
      "timezone": "Asia/Tehran"
    },
    "scopes": [
      "variant",
      "product",
      "question"
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "authorization_code": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/auth​/refresh-token

Generate New Access Token.
After your Access token got expired, you can get new one by your Refresh Token and expired access token
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "access_token": "eyJ0eXSiOiJKV1QiLCJjbGciOiJIUzM5nCJ9.eyJ0b2tlbl9pZCI6OSwiY2xZZW59X2NvZGUiOiJWdk9aNUxaNkx6dWVWTHFIVEY4TCIsImV4cCI6MTcyMzU4NDg1N30.QSU8llz4AwJTH-EJnPW4GQMfjnAu0m8Nh3sM9kkSIx_sCdm6rO8VeT5uVHU69reF",
  "refresh_token": "WQ098gF5PG3salmqewqvfbgxzzgTgAmWvkrQaWkgnpiqky1KAoqnxunQBz09Xc5UI1eg9tSo1h6k1"
}

Responses
Code	Description	Links
200	

ClientRefreshTokenForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "access_token": "eyJ0eXSiOiJKV1QiLCJjbGciOiJIUzM5nCJ9.eyJ0b2tlbl9pZCI6OSwiY2xZZW59X2NvZGUiOiJWdk9aNUxaNkx6dWVWTHFIVEY4TCIsImV4cCI6MTcyMzU4NDg1N30.QSU8llz4AwJTH-EJnPW4GQMfjnAu0m8Nh3sM9kkSIx_sCdm6rO8VeT5uVHU69reF",
    "refresh_token": "eyJ0eXSiOiJKV1QiLCJjbGciOiJIUzM5nCJ9",
    "access_token_expires_at": {
      "date": "2025-02-07 00:00:00.000000",
      "timezone_type": 3,
      "timezone": "Asia/Tehran"
    },
    "refresh_token_expires_at": {
      "date": "2025-02-07 00:00:00.000000",
      "timezone_type": 3,
      "timezone": "Asia/Tehran"
    },
    "scopes": [
      "variant",
      "product",
      "question"
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "access_token": [
      "این قسمت نباید خالی باشد"
    ],
    "refresh_token": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/auth​/revoke
Scopes => self_settings

Revoke seller access token for your application
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

RevokeTokenByClientForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "token revoked successfully"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Batch API (4)
POST
​/open-api​/v1​/batch​/inquiry
Scopes => self_settings

Check the status of Batch Job
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "batch_id": 1234
}

Responses
Code	Description	Links
200	

BatchInquiryForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "batch_id": 1234,
    "status": "completed",
    "items": [
      {
        "key": 1234,
        "status": "success",
        "errors": "{\n                                'message': 'error message',\n                                'variant_id': 'variant not exists',\n                            }"
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "batch_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/batch​/variant​/update
Scopes => variant

This is Batch API for updating product variant
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "deadline": 300,
  "items": {
    "variant_id": 1234,
    "payload": {
      "seller_stock": 123,
      "maximum_per_order": 123,
      "selling_price": 123,
      "shipping_type": "digikala",
      "lead_time": 1,
      "seller_lead_time": 24,
      "three_hour_delivery": false
    }
  }
}

Responses
Code	Description	Links
200	

VariantUpdateBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "batch_id": 1234,
    "status": "processing"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "items": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/batch​/variant​/activation​/update
Scopes => variant

This is Batch API for updating product variant
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "deadline": 300,
  "items": {
    "variant_id": 1234,
    "payload": {
      "activation": true
    }
  }
}

Responses
Code	Description	Links
200	

VariantActivationUpdateBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "batch_id": 1234,
    "status": "processing"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "items": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/batch​/variant​/seller-stock​/update
Scopes => variant

This is Batch API for updating product variant
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "deadline": 300,
  "items": {
    "variant_id": 1234,
    "payload": {
      "seller_stock": 123
    }
  }
}

Responses
Code	Description	Links
200	

VariantSellerStockUpdateBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "batch_id": 1234,
    "status": "processing"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "items": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Webhook (4)
GET
​/open-api​/v1​/webhook​/event-types
Scopes => self_settings

Get Client Subscription event types and activation_status
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

WebhookEventTypesObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "all_event_types": {
      "product_variant_status_change": "تغییر وضعیت تنوع کالایی",
      "order_shipment": "تغییر وضعیت ارسال سفارش",
      "seller_package_status_change": "تغییر وضعیت محموله ها",
      "commission_change": "تغییر در کمیسیون ها"
    },
    "allowed_event_types": [
      "product_variant_status_change",
      "commission_change",
      "seller_package_status_change"
    ],
    "active_event_types": [
      "commission_change"
    ],
    "activation_status": "inactive"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/webhook​/subscription
Scopes => self_settings

Subscribe event types for seller
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "event_types": [
    "product_variant_status_change"
  ]
}

Responses
Code	Description	Links
200	

WebhookSubscriptionForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "success"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "event_types": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/webhook​/unsubscription
Scopes => self_settings

Un subscribe event types for seller
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "event_types": [
    "product_variant_status_change"
  ]
}

Responses
Code	Description	Links
200	

WebhookUnsubscriptionForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "success"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "event_types": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/webhook​/subscription​/change-activation
Scopes => self_settings

Update Client Subscription Activation Status
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "activation": true
}

Responses
Code	Description	Links
200	

WebhookSubscriptionActivationForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "success"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "activation": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Category (2)
GET
​/open-api​/v1​/categories​/tree
Scopes => product

Return child of given category
Parameters
Try it out
Name	Description
search[parent_id]
integer
(query)
	

parent category id (if null, all root categories will be returned)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CategoryTreeOpenApiView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123,
        "title": "موبایل"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/categories​/{category_id}
Scopes => product

Get category details with parents and the configs that affect variants
Parameters
Try it out
Name	Description
category_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CategoryOpenApiObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "category": {
      "id": 123,
      "title": "موبایل",
      "active": true,
      "is_leaf": true,
      "configs": {
        "variant_photo": {
          "enabled": true,
          "level_on_create": "optional",
          "level_on_edit": "optional"
        }
      }
    },
    "parents": [
      {}
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "category_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Product (29)
GET
​/open-api​/v1​/product-creation​/search​/v2
Scopes => product

Based on search keyword and other filters prepared, this API gives data about products that are currently created on Digikala and seller might want to sell same one
Parameters
Try it out
Name	Description
search[keyword] *
string
(query)
	

search by product name
search[categories]
option
(query)
	

search by product category ids
search[brands]
option
(query)
	

search by product brand ids
search[types]
option
(query)
	

search by product type ids
search[colorPalettes]
option
(query)
	

search by color palette ids
search[statuses]
option
(query)
	

search by product statuses

Available values : marketable, coming_soon, stop_production
search[fake]
bool
(query)
	

search if product is fake or original
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductSearchListViewV2
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "title": "شارژر دیواری باسئوس  مدل Speed mini",
        "status": "marketable",
        "min_price": 1230000,
        "commission": {
          "canSell": false,
          "type": "limitation",
          "commission": 0.05,
          "message": [
            "فروش این کالا به یکی از دلایل زیر برای شما محدود شده است:</br>این کالا نیاز به <a href=\"https://selleracademy.digikala.com/%da%af%d8%b1%d9%88%d9%87-%d9%87%d8%a7%db%8c-%da%a9%d8%a7%d9%84%d8%a7%db%8c%db%8c-%da%a9%d9%87-%d8%a8%d8%b1%d8%a7%db%8c-%d9%81%d8%b1%d9%88%d8%b4-%d9%86%db%8c%d8%a7%d8%b2-%d8%a8%d9%87-%d9%85%d8%af%d8%b1/\">مجوز</a> دارد، این کالا به دلایل <a href=\"https://selleracademy.digikala.com/%D8%A7%D9%82%D9%84%D8%A7%D9%85-%D9%85%D9%85%D9%86%D9%88%D8%B9%D9%87/\">دیگری</a> محدود شده است."
          ]
        },
        "market_price": 1240000,
        "image_src": "https://dkstatics-public.digikala.com/digikala-products/85f13b62aba9a9ed31d2a02bf6e1e7fa_1628084094.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "price_type": {
          "recommended": "پیشنهادی"
        },
        "color_type": "colored",
        "number_of_sellers": 13,
        "is_selling": false,
        "site": "digikala"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/search​/suggestion​/v2
Scopes => product

Suggest Products to seller to sell based on the searched keyword. This is the first step of content creation process. it you want to add new product, first search it with this API. if found what you want,
Parameters
Try it out
Name	Description
search[keyword]
string
(query)
	

a word(mostly persian) that describe the product name you have for sell
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductSearchSuggestionListViewV2
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "categories": [
          {
            "keyword": "کوتون",
            "category": {
              "id": 1234,
              "title_fa": "تی شرت مردانه",
              "title_en": "MEN TEE-SHIRTS",
              "code": "men-tee-shirts"
            }
          }
        ],
        "auto_complete": [
          {
            "keyword": "کوتون"
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/be-seller​/{product_id}
Scopes => product
Parameters
Try it out
Name	Description
product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

BeingProductSellerView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "name": "شارژر تبلت دل",
    "brand": "دل",
    "productId": 1234,
    "commission": {
      "canSell": true,
      "commission": 0.055
    },
    "productURL": "https://digikala.com/product/dkp-1234/",
    "referencePrice": 10000000,
    "productImage": "https://dkstatics-public.digikala.com/digikala-products/2567.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
    "fulfillmentAndDeliveryCost": {
      "factor": 1,
      "minimum_cost": 100000,
      "maximum_cost": 800000
    },
    "category": {
      "id": 1234,
      "title": "شارژر تبلت و موبایل",
      "themes": [
        {
          "id": 1,
          "label": "سایز بالاتنه مردان",
          "themeType": "sized"
        }
      ]
    },
    "site": "digikala",
    "product_dimension": {
      "width": 11,
      "length": 22,
      "height": 6,
      "weight": 350
    },
    "price_type": "recommended"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "productId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/search​/category​/v2​/{keyword}
Scopes => product

This api find and show data of related categories for searched category_id or Keyword
Parameters
Try it out
Name	Description
keyword *
string, integer
(path)
	

category title OR id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductCategorySearchListViewV2
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 6351,
        "text": "ظرف مربا و عسل",
        "leaf": true
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/category​/{category_id}​/validation
Scopes => product

This API check if a Category is Restricted for seller to sale product or not. If not, it returns some data that is required to create product. it mostly used for 2nd step of product creation
Parameters
Try it out
Name	Description
category_id *
integer
(path)
	

Leaf (lowest level) category id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductCreationStep2ObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "errors": [
      "برای فروش در این گروه کالایی نیاز به مدرک ایکس است"
    ],
    "bind": {
      "brands": [
        {
          "id": 123,
          "text": "متفرقه Miscellaneous",
          "title_fa": "متفرقه",
          "title_en": "Miscellaneous",
          "logo_id": "https://dkstatics-public.digikala.com/digikala-brands/d37a7e9b8046132d4_1603699076.png"
        }
      ],
      "category_product_types": [
        {
          "value": "123",
          "text": "تابلو چارت"
        }
      ],
      "product_classes": [
        {
          "value": "123",
          "text": "آرجی‌بی RGB"
        }
      ],
      "divisions": [
        "division title"
      ],
      "guideline": {
        "category_selection": {
          "video": "https://dkstatics-public.digikala.com/digikala-brands/80005e48c",
          "short_description": "برای انتخاب گروه، لطفا نمونه مشابه کالای خود را در سایت دیجیکالا جست و جو کنید و چنانچه کالای یافت شده با کالایی که قصد درج آن را دارید یکسان بود، همان گروه را برای درج کالا انتخاب کنید."
        },
        "attributes": {
          "video": "https://dkstatics-public.digikala.com/digikala-brands/80005e48c",
          "short_description": "توضیح کوتاه",
          "items": [
            {
              "title": "مشخصات فنی نوشتاری",
              "content": "<p>لطفا در هنگام نوشتن مشخصات فنی، به نکات زیر دقت کنید:</p>\n\n<p>1- &nbsp; &nbsp; تمام مشخصات فنی ذکر شده در این قسمت باید با مشخصات کالا در تصاویر، عنوان و شرح کالا یکسان باشد در صورت مغایرت این اطلاعات با هم، کالای شما در زمان بررسی رد می شود.<br />\n2- &nbsp; &nbsp;مشخصات فنی وارد شده باید دقیقا مطابق با کالایی باشد که بفروش میرسانید و در صورت هر گونه مغایرت، کالا به این دلیل مرجوع و فروشنده جریمه می شود.&nbsp;<br />\n3- &nbsp; &nbsp; املا و نگارش کلمات باید صحیح باشد و هیچ غلط املایی در آن وجود نداشته باشد.<br />\n4- &nbsp; &nbsp;در مشخصات فنی نباید نام فروشگاه، قیمت و گارانتی کالا را بنویسید.<br />\n5- &nbsp; &nbsp; مشخصات فنی، مشخصات دقیقی هستند، بنابراین نباید از عبارات تبلیغاتی و سلیقه ای استفاده کنید.<br />\nمثال: عمر مفید زیاد، ظاهر زیبا و...<br />\n6- &nbsp; &nbsp;اگر مشخصه ی فنی دارای واحد اندازه گیری است، حتما از مطابقت این عدد با واحد اندازه گیری اطمینان حاصل کنید. در صورت مغایرت، احتمال مرجوع شدن کالا زیاد است.<br />\n7- &nbsp; &nbsp; چنانچه کالای درج شده، چند پارچه یا چند تکه است باید مشخصات فنی تمام اجزا را در مشخصات کالا ذکر کنید.</p>"
            }
          ]
        },
        "product_info": {
          "video": "https://dkstatics-public.digikala.com/digikala-brands/80005e48c",
          "short_description": "هرچی",
          "items": [
            {
              "title": "نشان غیراصل",
              "content": "<p>اصالت کالا (نشان غیر اصل): اگر روی کالا برندی وجود دارد که آن محصول توسط آن برند تولید نشده است، باید از نشان غیر اصل استفاده کنید. اگرروی کالا هیچ برندی وجود ندارد، نباید از نشان غیر اصل استفاده کرد و محصول را با برند متفرقه درج کنید.</p>\n\n<p>1- &nbsp; &nbsp;اگر محصول غیراصل است و از نشان غیر اصل استفاده می&zwnj;کنید، نباید هیچ برندی در عنوان کالا ذکر شود.<br />\n2- &nbsp; &nbsp;اگر کالایی نشان غیر اصل نداشته باشد به معنای این است که آن کالا اصل و تولید شده توسط آن برند است. اگر روی این کالا، کالای فیک بفروشید، مشمول جریمه خواهید شد. برای اطلاع بیشتر به این <a href=\"https://www.digikala.com/s/7ilfbc\">لینک</a><strong> </strong> مراجعه کنید.</p>"
            }
          ]
        },
        "media": {
          "video": "https://dkstatics-public.digikala.com/digikala-brands/80005e48c",
          "short_description": "توضیح کوتاه",
          "items": [
            {
              "title": "تصویر آلبوم",
              "content": "<p>تصاویر آلبوم برای نمایش زوایا و کاربرد کالا به مشتری است.<br />\n1- &nbsp; &nbsp;در هیچ کدام از تصاویر آلبوم نباید هیچ لوگو و واترمارکی وجود داشته باشد.<br />\n2- &nbsp; &nbsp;در تصاویر آلبوم نباید هیچ آدرس سایت، شماره تلفن و نشانی شبکه ها اجتماعی وجود داشته باشد. (لطفا اگر این موارد روی کالا یا بسته بندی وجود دارد طوری عکاسی کنید تا این موارد در تصاویر دیده نشود.)<br />\n3- &nbsp; &nbsp;در تصاویر آلبوم، طرح های مختلف یک کالا را قرار ندهید، برای هر طرح باید یک کالای جداگانه درج شود.<br />\n4- &nbsp; &nbsp;دقت کنید که بین هیچ کدام از تصاویر نباید مغایرتی وجود داشته باشد.</p>"
            }
          ]
        }
      },
      "category_data": {
        "categoryTheme": "no_color_no_size",
        "categoryThemeTranslated": "بدون رنگ یا سایز",
        "categoryTitle": "نقشه چاپی"
      },
      "allow_fake": true,
      "brand_other_id": 123,
      "show_colors": false,
      "dimension_level": "item",
      "dimension_config": {
        "length": {
          "min": 1,
          "max": 200
        },
        "width": {
          "min": 1,
          "max": 200
        },
        "height": {
          "min": 1,
          "max": 200
        },
        "weight": {
          "min": 1,
          "max": 200000
        }
      },
      "general_mefa": {
        "general_mefa_id": {
          "value": 17242,
          "text": "2720000114030(اطلس چاپی و مکتوب - شناسه عمومی تولید داخل)",
          "general_id": 2720000114030
        }
      },
      "category_mefa_type": "general",
      "statuses": [
        {
          "value": "marketable",
          "text": "قابل فروش",
          "selected": true
        }
      ],
      "platforms": [
        {
          "value": "digikala",
          "text": "دیجیکالا",
          "selected": true
        }
      ]
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "category_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/product​/detail​/validation
Scopes => product

Add Valid Product details
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "category_id": 1234,
  "division_id": 1234,
  "model": "S22 fan edition",
  "brand_id": "Samsung",
  "reference_brand_id": 1234,
  "product_type_ids": [
    1234
  ],
  "color_id": 1234,
  "is_iranian": true,
  "product_classes": [
    123
  ],
  "fake": true,
  "fake_reasons": [
    1234
  ],
  "general_mefa_id": "2132114141312321",
  "exclusive_mefa_id": "2132114141312321",
  "package_width": 12,
  "package_height": 12,
  "package_length": 12,
  "package_weight": 12,
  "description": "این محصول از توانایی های عجیبی برخوردار است ",
  "disadvantages": [
    "محصول بد، محصول ضعیف، باطری ضعیف "
  ],
  "advantages": [
    "محصول خوب، محصول عالی، باطری قوی "
  ],
  "draft_product_id": 1234
}

Responses
Code	Description	Links
200	

ProductCreationStep2ValidationForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "is_valid": true,
    "errors": [
      "برای فروش در این گروه کالایی نیاز به مدرک ایکس است"
    ],
    "bind": {
      "vat": 9,
      "product_nature": "non_fmcg",
      "sensitivity": "normal",
      "status": "marketable",
      "active": true,
      "active_digistyle": false,
      "product_type": "product",
      "site": "digikala",
      "platforms": [
        "digikala"
      ],
      "fake_reasons": [
        ""
      ],
      "category_id": 9882,
      "division_id": 123,
      "model": "زیررررو",
      "brand_id": 719,
      "reference_brand_id": 1234,
      "product_type_ids": [
        19709
      ],
      "is_iranian": true,
      "fake": false,
      "general_mefa_id": 17242,
      "exclusive_mefa_id": "",
      "package_width": 123,
      "package_height": 123,
      "package_length": 123,
      "package_weight": 123,
      "description": "شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست ",
      "advantages": [
        "خووبه"
      ],
      "disadvantages": [
        "بدددده"
      ]
    },
    "draft_product_id": 1839
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "category_id": [
      "این قسمت نباید خالی باشد"
    ],
    "brand_id": [
      "این قسمت نباید خالی باشد"
    ],
    "is_iranian": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/draft-product​/count
Scopes => product

Return Number Of Seller Draft Products.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DraftProductCountObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "number_of_drafts": 54
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/draft-product​/{draft_product_id}
Scopes => product

Return a draft product entity
Parameters
Try it out
Name	Description
draft_product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DraftProductObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123,
    "category_id": 123,
    "category_name": "نقشه چاپی",
    "division_id": 123,
    "model": "زیررررو",
    "brand_id": 123,
    "brand_name": "متفرقه",
    "reference_brand_id": 1234,
    "reference_brand_name": "سامسونگ",
    "product_type_ids": [
      19709
    ],
    "is_iranian": true,
    "product_classes": [
      2
    ],
    "fake": false,
    "general_mefa_id": 17242,
    "exclusive_mefa_id": "",
    "package_width": 123,
    "package_height": 123,
    "package_length": 123,
    "package_weight": 123,
    "platforms": [
      "digikala"
    ],
    "description": "شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست ",
    "advantages": [
      "خووبه"
    ],
    "disadvantages": [
      "بدددده"
    ],
    "title_en": "نام کالا",
    "title_fa": "نام کالا",
    "width": 1,
    "height": 1,
    "length": 1,
    "weight": 1,
    "remaining_day": 29,
    "site": "digikala",
    "status": "marketable",
    "product_type": "product",
    "product_nature": "non_fmcg",
    "active": true,
    "active_digistyle": false,
    "sensitivity": "normal",
    "vat": 9,
    "next_step": [
      "step title"
    ],
    "step": "step_basic_info",
    "score": {
      "score_details": {
        "category": {
          "max": 1,
          "current": 1
        },
        "brand": {
          "max": 1,
          "current": 1
        },
        "type": {
          "max": 1,
          "current": 1
        },
        "model": {
          "max": 1,
          "current": 1
        },
        "originality": {
          "max": 1,
          "current": 1
        },
        "division": {
          "max": 1,
          "current": 0
        },
        "mefa": {
          "max": 1,
          "current": 1
        },
        "description": {
          "max": 2,
          "current": 2
        },
        "advantage": {
          "max": 2,
          "current": 2
        },
        "disadvantage": {
          "max": 2,
          "current": 2
        },
        "attribute_1597": {
          "max": 2,
          "current": 0
        },
        "title_fa": {
          "max": 1,
          "current": 0
        },
        "title_en": {
          "max": 2,
          "current": 0
        },
        "photo": {
          "max": 6,
          "current": 0
        }
      },
      "total": 12,
      "max": 31,
      "percent": 38
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "draft_product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/{draft_product_id}​/auto-title
Scopes => product

Get Title Suggestion Data After product details added to draft
Parameters
Try it out
Name	Description
draft_product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductCreationAutoTitleSuggestionObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "title_fa": "کتاب مدل زیروووو",
    "title_en": "",
    "hint": {
      "hint_fa": "ماهیت کالا + برند کالا + مدل کالا",
      "hint_en": ""
    },
    "enable_edit": true
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "draft_product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/auto-title​/save
Scopes => product

Validate Title
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "draft_product_id": 1234,
  "title_fa": "لباس زیر مردانه برند کالوین کلین مدل m22",
  "title_en": "Men's underwear Calvin Klein m22",
  "description": "این محصول از توانایی های عجیبی برخوردار است",
  "advantages": [
    "محصول خوب"
  ],
  "disadvantages": [
    "محصول بد"
  ]
}

Responses
Code	Description	Links
200	

ProductCreationSaveTitleValidationForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "data": {
      "title_fa": "کتاب مدل زیرووو",
      "title_en": "Book Zirooo model",
      "suggested_title_fa": "کتاب مدل زیرو",
      "suggested_title_en": "",
      "url_code": "کتاب-مدل-زیرووو"
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "title_fa": [
      "این قسمت نباید خالی باشد"
    ],
    "draft_product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/attributes​/{category_id}
Scopes => product

Get Category Attributes
Parameters
Try it out
Name	Description
category_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CategoryAttributesValidatableObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "category_group_attributes": {
      "1904": {
        "group_title": "مشخصات",
        "attributes": {
          "119": {
            "id": 123,
            "title": "سایر توضیحات",
            "code": "s1",
            "postfix": "سایر توضیحات",
            "unit": "سانت",
            "type": "text",
            "required": false,
            "value": "",
            "values": [
              "allowable value"
            ],
            "hint": "در صورت نیاز می‌توانید توضیحاتی مختصر در مورد ویژگی‌های کالا ارائه دهید."
          },
          "1597": {
            "id": 123,
            "title": "سایر توضیحات",
            "code": "s1",
            "postfix": "سایر توضیحات",
            "unit": "سانت",
            "type": "select",
            "required": false,
            "value": 7070,
            "values": {
              "7070": {
                "text": "فارسی",
                "code": 1,
                "selected": false
              }
            },
            "hint": "در صورت نیاز می‌توانید توضیحاتی مختصر در مورد ویژگی‌های کالا ارائه دهید."
          }
        }
      }
    },
    "attribute_dimensions": false,
    "dimensions_attribute_postfix": "سانتی متر",
    "has_height": false,
    "dimensions_attribute": false,
    "weight_attribute": false,
    "weight_attribute_postfix": "گرم",
    "weight_attribute_required": false,
    "weight_attribute_reasons": false,
    "weight_attribute_hint": "",
    "dimensions_attribute_required": false,
    "dimensions_attribute_hint": "راهنمای ابعاد",
    "dimension_attribute_multiplier": 1,
    "weight_attribute_multiplier": 2
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "category_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/attributes
Scopes => product

Validate Attributes through product creation
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "draft_product_id": 1234,
  "length": 12.3,
  "width": 12.3,
  "height": 12.3,
  "weight": 12.3,
  "attributes": {}
}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/images​/requests​/brand-logo​/upload
Scopes => product

Upload Brand Request Logo Image To Temp Storage
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body
file *
string($binary)
	

The brand image file (jpeg, jpg, png)
Responses
Code	Description	Links
200	

ContentCreationBrandRequestLogoImageForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "data": {
      "id": "4NObd",
      "url": "https://dkstatic-public-demo.digikala.com/digikala-products/14d8546b536c1e74fa53ec2203471f5d45_1724103997.jpg?x-oss-process=image/resize,m_fill,h_90,w_90",
      "tempFile": true
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "file": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/images​/requests​/upload
Scopes => product

Upload Content Request Image To Temp Storage
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body
file *
string($binary)
	

The image file (jpeg, jpg, png)
Responses
Code	Description	Links
200	

ContentCreationRequestUploadImageForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "data": {
      "id": "4NObd",
      "url": "https://dkstatic-public-demo.digikala.com/digikala-products/14d8546b536c1e74fa53ec2203471f5d45_1724103997.jpg?x-oss-process=image/resize,m_fill,h_90,w_90",
      "tempFile": true
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "file": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/images​/upload
Scopes => product

Upload Product Image To Temp Storage
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body
file *
string($binary)
	

The Product image file in binary (jpeg, jpg, png)
Responses
Code	Description	Links
200	

ProductCreationUploadImageForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "data": {
      "id": "4NObd",
      "url": "https://dkstatic-public-demo.digikala.com/digikala-products/14d8546b536c1e74fa53ec2203471f5d45_1724103997.jpg?x-oss-process=image/resize,m_fill,h_90,w_90",
      "tempFile": true
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "file": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/images​/ai
Scopes => product

Check Image With AI and return some guidance (if exists)
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "image_id": "123exasd412",
  "is_main": true
}

Responses
Code	Description	Links
200	

ProductCreationImageAIForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true,
    "data": [
      "بک گراند عکس بهتر است سفید باشد"
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/save
Scopes => product

Save Product
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "category_id": 123,
  "draft_product_id": 1234,
  "use_temp_images": false,
  "only_b2b": false,
  "photos_detail": {
    "main_image": "4NObd",
    "order": "4NObd,4NObe",
    "images": {
      "encrypted_id": "4NObd",
      "active": true
    }
  }
}

Responses
Code	Description	Links
200	

ProductCreationStep5Form
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "data": {
      "product_id": 1234
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "category_id": [
      "این قسمت نباید خالی باشد"
    ],
    "only_b2b": [
      "این قسمت نباید خالی باشد"
    ],
    "draft_product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/assign
Scopes => product

Assign Product To Seller
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "productId": 1234
}

Responses
Code	Description	Links
200	

ProductAssignForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "productId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-creation​/brand​/request
Scopes => product

Create Brand Request Through Product Creation.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "brand_origin": "iranian",
  "description": "به بررسی آمار و عملکرد افرادی که در بهمن ماه 1402 در چالش‌های چالش‌های چالش‌های چالش‌های چالش‌های چالش‌های رابین سود شرکت کرده‌اند می‌پردازیم...",
  "logo_id": "4NObf",
  "name_en": "mine",
  "name_fa": "برند خودم",
  "iranian_registration_url": "https://ipm.ssaa.ir/Search-Result?page=2&DecNo=139650140001026526&RN=280832",
  "purpose": "brand",
  "category_id": 9882
}

Responses
Code	Description	Links
200	

BrandRequestForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "data": {
      "id": 48918
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "logo_id": [
      "این قسمت نباید خالی باشد"
    ],
    "name_fa": [
      "این قسمت نباید خالی باشد"
    ],
    "name_en": [
      "این قسمت نباید خالی باشد"
    ],
    "brand_origin": [
      "این قسمت نباید خالی باشد"
    ],
    "description": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-creation​/brand
Scopes => product

Search Brands in Digikala By Name. When neither title_fa nor title_en is given, it returns all active brands ordered by name_fa then id, paged by page and size (size is limited to 100); the response shape (data.items) is the same.
Parameters
Try it out
Name	Description
search[title_fa]
string
(query)
	

brand keyword search in FA. Optional: without any title the full active brand list is returned, paged.
search[title_en]
string
(query)
	

brand keyword search in EN. Optional: without any title the full active brand list is returned, paged.
page
integer
(query)
	

page number, used only when no title is given

Default value : 1
size
integer
(query)
	

page size, used only when no title is given (maximum 100)

Default value : 50
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchBrandsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "شیائومی": {
          "id": 1234,
          "keyword": "شیائومی Xiaomi",
          "name_fa": "شیائومی",
          "name_en": "Xiaomi",
          "description": "برند معروف شیائومی Xiaomi یکی از بزرگ&zwnj;ترین سازندگان گوشی&zwnj;های تلفن همراه هوشمند با استفاده از جدیدترین تکنولوژی&zwnj;های جهان از سال 2010 در چین فعالیتش را آغاز کرده است. نقطه&zwnj;ی برجسته&zwnj;ی گوشی موبایل شیائومی قیمت آن&zwnj;ها است. این برند با تولید گوشی&zwnj;های تلفن همراه مقرون&zwnj;به&zwnj;صرفه در سراسر دنیا طرفداران ویژه&zwnj;ی خود را دارد.این برند&nbsp;انواع گجت&zwnj;های دیگر ازجمله دستبند سلامتی، پهپاد، لامپ هوشمند، ربات جاروبرقی، پاور بانک، دوربین&zwnj;های امنیتی و کفش&zwnj;های ورزشی هوشمند را تولید می&zwnj;کند.",
          "is_iranian": false,
          "logo": "https://dkstatics-public.digikala.com/digikala-brands/12394.png?x-oss-process=image/resize,m_lfit,h_80,w_80"
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/draft-products​/seller
Scopes => product

Return List Of Seller Draft Products.
Parameters
Try it out
Name	Description
search[brand_ids]
array
(query)
	

list of product brand ids
search[category_ids]
array
(query)
	

list of product leaf category ids
search[near_expiration]
bool
(query)
	

filter draft product that their expiration time is near
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerDraftProductListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123,
        "category_id": 123,
        "category_name": "نقشه چاپی",
        "division_id": 123,
        "model": "زیررررو",
        "brand_id": 123,
        "brand_name": "متفرقه",
        "reference_brand_id": 1234,
        "reference_brand_name": "سامسونگ",
        "product_type_ids": [
          19709
        ],
        "is_iranian": true,
        "product_classes": [
          2
        ],
        "fake": false,
        "general_mefa_id": 17242,
        "exclusive_mefa_id": "",
        "package_width": 123,
        "package_height": 123,
        "package_length": 123,
        "package_weight": 123,
        "platforms": [
          "digikala"
        ],
        "description": "شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست ",
        "advantages": [
          "خووبه"
        ],
        "disadvantages": [
          "بدددده"
        ],
        "title_en": "نام کالا",
        "title_fa": "نام کالا",
        "width": 1,
        "height": 1,
        "length": 1,
        "weight": 1,
        "remaining_day": 29,
        "site": "digikala",
        "status": "marketable",
        "product_type": "product",
        "product_nature": "non_fmcg",
        "active": true,
        "active_digistyle": false,
        "sensitivity": "normal",
        "vat": 9,
        "next_step": [
          "step title"
        ],
        "step": "step_basic_info",
        "score": {
          "score_details": {
            "category": {
              "max": 1,
              "current": 1
            },
            "brand": {
              "max": 1,
              "current": 1
            },
            "type": {
              "max": 1,
              "current": 1
            },
            "model": {
              "max": 1,
              "current": 1
            },
            "originality": {
              "max": 1,
              "current": 1
            },
            "division": {
              "max": 1,
              "current": 0
            },
            "mefa": {
              "max": 1,
              "current": 1
            },
            "description": {
              "max": 2,
              "current": 2
            },
            "advantage": {
              "max": 2,
              "current": 2
            },
            "disadvantage": {
              "max": 2,
              "current": 2
            },
            "attribute_1597": {
              "max": 2,
              "current": 0
            },
            "title_fa": {
              "max": 1,
              "current": 0
            },
            "title_en": {
              "max": 2,
              "current": 0
            },
            "photo": {
              "max": 6,
              "current": 0
            }
          },
          "total": 12,
          "max": 31,
          "percent": 38
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/draft-products​/{draft_product_id}
Scopes => product

Delete a draft product
Parameters
Try it out
Name	Description
draft_product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DeleteDraftProductForm
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/products​/seller
Scopes => product

seller product list view
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[multi_search]
search box
(query)
	

search by product title or id
search[category_id]
option
(query)
	

search by category id
search[brand_id]
option
(query)
	

search by brand id
search[moderation_status]
option
(query)
	

search by product moderation status id

Available values : draft, in_review, waiting_for_confirm, edit_after_approved, approved, in_review_after_approved, removed, duplicate
search[fake_status]
radio
(query)
	

search by product originality

Available values : fake, real
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerProductManagementListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "variants_count": 1,
        "site": "digikala",
        "title": "کتاب مدل زیرووو",
        "status": "marketable",
        "product_id": 14329321,
        "fake": false,
        "status_data": "draft",
        "is_owner": true,
        "main_category_title": {
          "9882": "نقشه چاپی"
        },
        "active": true,
        "title_fa": "کتاب مدل زیرووو",
        "title_en": "Book Zirooo model",
        "brand_id": 7663,
        "brand_title_en": "H&M",
        "brand_title_fa": "اچ اند ام",
        "product_url": "https://demo.digikala.com/product/dkp-14329321/",
        "image_src": "https://dkstatic-public-demo.digikala.com/digikala-products/1472643fd536c1e74fa53ec2203471f5d45_1724103997.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "dimension_level": "item",
        "brand_title": "اچ اند ام - H&M",
        "moderation_status": {
          "title": "draft",
          "status": "draft"
        },
        "adverge_url": "www.adverge.ir",
        "product_dimension": {
          "width": 11,
          "length": 22,
          "height": 6,
          "weight": 350
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/products​/{product_id}​/score
Scopes => product

Get Content Score of Product.
Parameters
Try it out
Name	Description
product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductContentScoreObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "score": {
      "max": 1,
      "current": 1
    },
    "scores": {
      "score_details": {
        "category": {
          "max": 1,
          "current": 1
        },
        "brand": {
          "max": 1,
          "current": 1
        },
        "type": {
          "max": 1,
          "current": 1
        },
        "model": {
          "max": 1,
          "current": 1
        },
        "originality": {
          "max": 1,
          "current": 1
        },
        "division": {
          "max": 1,
          "current": 0
        },
        "mefa": {
          "max": 1,
          "current": 1
        },
        "description": {
          "max": 2,
          "current": 2
        },
        "advantage": {
          "max": 2,
          "current": 2
        },
        "disadvantage": {
          "max": 2,
          "current": 2
        },
        "attribute_1597": {
          "max": 2,
          "current": 0
        },
        "title_fa": {
          "max": 1,
          "current": 0
        },
        "title_en": {
          "max": 2,
          "current": 0
        },
        "photo": {
          "max": 6,
          "current": 0
        }
      },
      "total": 12,
      "max": 31,
      "percent": 38
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/products​/shopping
Scopes => product, variant

Returns the content, pricing and relation data of each requested product together with all of its variants (from every seller). Products that do not exist are omitted from the result. Up to 10 product ids can be requested in one call.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "ids": [
    16653146,
    16653147
  ]
}

Responses
Code	Description	Links
200	

ProductShoppingForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "product": {
      "id": 16653146,
      "content": {
        "title_fa": "کوله پشتی هیماواری مدل دونات M001-9018",
        "title_en": "",
        "test_title_fa": null,
        "test_title_en": null,
        "product_type": "product",
        "description": "کوله پشتی لپ تاپ 14 اینچی",
        "short_review": null,
        "urls": {
          "digikala": "https://www.digikala.com/product/dkp-16653146/"
        },
        "attributes": [
          {
            "title": "مشخصات",
            "attributes": {
              "additionalProp1": {
                "title": "وزن",
                "textValue": "630",
                "postfix": "گرم",
                "values": [
                  {
                    "title": "قابلیت تنظیم بند"
                  }
                ]
              },
              "additionalProp2": {
                "title": "وزن",
                "textValue": "630",
                "postfix": "گرم",
                "values": [
                  {
                    "title": "قابلیت تنظیم بند"
                  }
                ]
              },
              "additionalProp3": {
                "title": "وزن",
                "textValue": "630",
                "postfix": "گرم",
                "values": [
                  {
                    "title": "قابلیت تنظیم بند"
                  }
                ]
              }
            }
          }
        ],
        "in_index_attributes": {
          "additionalProp1": {
            "title": "وزن",
            "textValue": "630",
            "postfix": "گرم",
            "values": [
              {
                "title": "قابلیت تنظیم بند"
              }
            ]
          },
          "additionalProp2": {
            "title": "وزن",
            "textValue": "630",
            "postfix": "گرم",
            "values": [
              {
                "title": "قابلیت تنظیم بند"
              }
            ]
          },
          "additionalProp3": {
            "title": "وزن",
            "textValue": "630",
            "postfix": "گرم",
            "values": [
              {
                "title": "قابلیت تنظیم بند"
              }
            ]
          }
        },
        "images": [
          "https://dkstatics-public.digikala.com/digikala-products/1.jpg"
        ],
        "color_image_mapping": [
          {
            "id": 1,
            "title": "مشکی",
            "hex_code": "#000000",
            "images": [
              "string"
            ]
          }
        ],
        "is_fake": false,
        "rates": {
          "rate": 63.33,
          "count": 6,
          "percentages": {
            "additionalProp1": 0,
            "additionalProp2": 0,
            "additionalProp3": 0
          }
        },
        "questions": {
          "count": 6
        },
        "reviews": {
          "count": 5
        }
      },
      "pricing": {
        "status": "marketable",
        "has_price_chart": true,
        "has_offline_shop_stock": false,
        "buybox": {
          "winner_id": 61040493,
          "scores": {}
        }
      },
      "relation": {
        "brand": {
          "id": 18225,
          "code": "himawari",
          "title_fa": "هیماواری",
          "title_en": "Himawari",
          "visibility": true,
          "logo_url": "https://dkstatics-public.digikala.com/digikala-brands/logo.png",
          "is_premium": false,
          "is_miscellaneous": false,
          "is_name_similar": false
        },
        "category": {
          "id": 6023,
          "title": "کیف و کوله سفری",
          "title_en": "Travell bages and backpackes",
          "code": "bag-and-backpack",
          "content_description": "",
          "content_box": "",
          "return_reason_alert": "درخواست مرجوع کردن کالا در گروه کیف و کوله با دلیل \"انصراف از خرید\" امکان‌پذیر نیست.",
          "has_quick_view": false,
          "has_true_to_size": false,
          "show_type": "normal",
          "parent_categories": [
            {
              "id": 6124,
              "title": "ورزش و سفر",
              "code": "sport-entertainment"
            }
          ]
        },
        "gallery_variant_type": "grid"
      }
    },
    "variants": [
      {
        "variant": {
          "id": 61040493,
          "is_marketable": true,
          "stock": {
            "lead_time": {
              "variant": 1
            },
            "is_eligible_for_jet_delivery": false
          },
          "pricing": {
            "pricing_stock": {
              "order_limit": 4,
              "marketable_stock": 1,
              "is_promotion": false
            },
            "price_ids": {
              "default": {
                "selling_price": 74990000,
                "rrp_price": 74990000,
                "discount_percent": 0,
                "is_incredible_offer": false,
                "is_locked_for_plus": false,
                "variant_gold_price_details": {
                  "gold_price": 100,
                  "non_gold_parts_cost": 100,
                  "non_gold_parts_wage": 100,
                  "gold_wage": 20,
                  "profit": 6,
                  "size": 5.14,
                  "tax": 10,
                  "carat": "carat_18",
                  "gold_total_price": 165727800,
                  "total_profit": 13591521.02,
                  "total_tax": 13591521.02,
                  "total_gold_wage": 33697986
                }
              }
            },
            "badges": [
              {
                "id": -1,
                "type": "simple",
                "slot": "pdp_above_add_to_cart",
                "priority": 0,
                "payload": {
                  "text": "تنها 1 عدد در انبار باقی مانده",
                  "text_color": "#d32f2f",
                  "svg_icon": "https://dkstatics-public.digikala.com/digikala-static/icon.svg"
                }
              }
            ]
          },
          "attributes": {
            "gifts": [
              {}
            ],
            "has_similar_variants": false,
            "has_size_guide": null,
            "themes": [
              {
                "label": "رنگ",
                "type": "colored",
                "is_main": true,
                "value": {
                  "id": 1,
                  "title": "مشکی",
                  "code": "#000000",
                  "nature": "color"
                }
              }
            ],
            "warranty": {
              "id": 272,
              "title": "گارانتی اصالت و سلامت فیزیکی کالا"
            }
          },
          "content": {
            "seller_stats": {
              "totally_satisfied": {
                "rate_count": 1,
                "rate": 100
              },
              "satisfied": {
                "rate_count": 1,
                "rate": 100
              },
              "neutral": {
                "rate_count": 1,
                "rate": 100
              },
              "dissatisfied": {
                "rate_count": 1,
                "rate": 100
              },
              "totally_dissatisfied": {
                "rate_count": 1,
                "rate": 100
              },
              "total_count": 1,
              "total_rate": 100
            },
            "seller_rate": 100,
            "is_ship_by_seller": true,
            "is_multi_warehouse": false,
            "is_rural": false,
            "has_nearby_shipment": true
          }
        },
        "seller": {
          "id": 194764,
          "name": "پرو پلاس",
          "code": "APXU5",
          "is_trusted": true,
          "is_roosta_seller": false,
          "rate": 78,
          "rate_count": 20023,
          "sold_items": 20000,
          "registered_at": 1567070553,
          "rating": {
            "cancel_percentage": 100,
            "return_percentage": 99.4,
            "ship_on_time_percentage": 99.8,
            "final_score": 5
          },
          "badges": [
            {
              "title": "از برترین‌های",
              "description": "کالای دیجیتال",
              "icon_url": "https://dkstatics-public.digikala.com/digikala-static/badge.svg",
              "category": {
                "code": "electronic-devices",
                "title": "کالای دیجیتال"
              }
            }
          ],
          "hint": [
            {}
          ],
          "main_category": {
            "id": 5966,
            "code": "electronic-devices",
            "title": "کالای دیجیتال"
          }
        }
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "ids": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-edit​/{product_id}​/publish
Scopes => product

Publish Product after Edit
Parameters
Try it out
Name	Description
product_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

ProductPublishForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "isValid": true
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/product-edit​/{product_id}
Scopes => product

View Of Product For Edition.
Parameters
Try it out
Name	Description
product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductEditObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "product_data": {
      "id": 1234,
      "marketplace_seller_id": 123,
      "category_id": 123,
      "division_id": 123,
      "model": "زیررررو",
      "brand_id": 123,
      "reference_brand_id": 1234,
      "reference_brand_name": "سامسونگ",
      "product_type_ids": [
        123
      ],
      "product_type": "type",
      "show_colors": false,
      "is_iranian": true,
      "product_classes": [
        2
      ],
      "fake": false,
      "general_mefa_id": 1234,
      "package_width": 1,
      "package_height": 1,
      "package_length": 1,
      "package_weight": 1,
      "platforms": [
        "digikala"
      ],
      "description": "شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست شرح کالا اینجاست ",
      "advantages": [
        "خووبه"
      ],
      "disadvantages": [
        "بدددده"
      ],
      "title_en": "Book Zirooo model",
      "title_fa": "کتاب مدل زیرووو",
      "attributes": {
        "9882": {
          "119": "هیچ توضیح دیگه ای نیست"
        }
      },
      "width": 1,
      "height": 1,
      "length": 1,
      "weight": 1,
      "brand_name": "اچ اند ام",
      "moderation_status": "draft",
      "images": [
        {
          "encrypted_id": "VHF2NnVWNTJxODEzUTJ1TGNOYS82SGdMajU3ZXo0RTgxQVhuUEhPelFMWjhXVkticlhYSkZTMDVuZHI0V0E9PQ==",
          "image_url": "https://dkstatic-public-demo.digikala.com/digikala-products/1472643fb536c1e74fa53ec2203471f5d45_1724104259.jpg?x-oss-process=image/resize,m_fill,h_90,w_90",
          "image_max_url": "https://dkstatic-public-demo.digikala.com/digikala-products/1473fd8546b536c1e74fa53ec2203471f5d45_1724104259.jpg",
          "is_main": false,
          "options": {
            "type": "jpg",
            "watermark": true,
            "copyright": false,
            "is_active": true,
            "sort": 1
          },
          "order": 1
        }
      ]
    },
    "moderation_response": {
      "images": [
        ""
      ]
    },
    "enabled_fields": [
      "description"
    ],
    "steps_moderation_status": {
      "step_title": false,
      "step_category": false,
      "step_basic_info": false,
      "step_attribute": false,
      "step_image": false
    },
    "locked_for_moderation": false,
    "multi_seller_product": false,
    "edit_status": "draft"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/product-edit​/{product_id}
Scopes => product

Edit Product Fields.
Parameters
Try it out
Name	Description
product_id *
integer
(path)
	

product id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "category_id": 1234,
  "division_id": 1234,
  "model": "S22 fan edition",
  "brand_id": "Samsung",
  "reference_brand_id": 1234,
  "product_type_ids": [
    1234
  ],
  "color_id": 1234,
  "is_iranian": true,
  "product_classes": [
    123
  ],
  "fake": true,
  "general_mefa_id": "2132114141312321",
  "exclusive_mefa_id": "2132114141312321",
  "package_width": 12,
  "package_height": 12,
  "package_length": 12,
  "package_weight": 12,
  "description": "این محصول از توانایی های عجیبی برخوردار است ",
  "disadvantages": [
    "محصول بد، محصول ضعیف، باطری ضعیف "
  ],
  "advantages": [
    "محصول خوب، محصول عالی، باطری قوی "
  ],
  "width": 12,
  "height": 12,
  "length": 12,
  "weight": 12,
  "attributes": {
    "123": {
      "id": 12,
      "value": [
        "digikala",
        "digistyle"
      ]
    }
  },
  "title_fa": "کتاب زیروووو",
  "title_en": "Zero Book",
  "use_temp_images": false,
  "photos_detail": {
    "main_image": "4NObd",
    "order": "4NObd,4NObe",
    "images": {
      "encrypted_id": "4NObd",
      "active": true
    }
  },
  "video_ids": [
    "123bsd"
  ]
}

Responses
Code	Description	Links
200	

ProductEditForm
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/product-edit​/{category_id}​/auto-title
Scopes => product

Get Title Suggestion Data By Product Fields
Parameters
Try it out
Name	Description
category_id *
integer
(path)
	

product leaf category id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "division_id": 1234,
  "model": "S22 fan edition",
  "brand_id": "Samsung",
  "product_type_ids": [
    1234
  ],
  "attributes": {
    "123": {
      "id": 12,
      "value": [
        "digikala",
        "digistyle"
      ]
    }
  }
}

Responses
Code	Description	Links
200	

ProductEditAutoTitleSuggestionForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "title_fa": "کتاب مدل زیروووو",
    "title_en": "",
    "hint": {
      "hint_fa": "ماهیت کالا + برند کالا + مدل کالا",
      "hint_en": ""
    },
    "enable_edit": true
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Product Variant (15)
GET
​/open-api​/v1​/variants
Scopes => variant

List of seller variants.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id, product_variant_id, selling_stock, selling_price, marketplace_seller_stock, warehouse_stock, created_at

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[id]
integer
(query)
	

variant id
search[ids]
string
(query)
	

underscore (_) seperated variant ids
search[shipping_type]
string
(query)
	

type of shipping

Available values : seller, digikala, both
search[active]
boolean
(query)
	

if the variant is active or not
search[moderation_status]
string
(query)
	

moderation status of variant related product
search[category_ids]
string,integer
(query)
	

Comma seperated category ids.
search[buy_box_winner]
string
(query)
	

if the variant is boy box winner of whole product or color/size

Available values : product, no_winner, sku, suppressed
search[in_competition]
boolean
(query)
	

if variant has other competition
search[search_term]
string
(query)
	

Search in variant id, title and product id, title
search[price_terms]
string
(query)
	

Comma seperated price conditions for search.
search[out_of_stock]
boolean
(query)
	

if the variant has no stock
search[archived]
boolean
(query)
	

if the variant is archived
search[selling_channel]
string
(query)
	

selling channels

Available values : digikala, digistyle, digikala_digistyle, b2b, digikala_b2b, digistyle_b2b, all
search[creation_time_from]
datetime
(query)
	

variant creation datetime - since (georgian)
search[creation_time_to]
datetime
(query)
	

variant creation datetime - up to (georgian)
search[seller_product_tags]
string
(query)
	

Search for variants with specified product tags
search[nearby_seller_shipment]
boolean
(query)
	

Filter variants by three-hour delivery (nearby seller shipment) status
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "product_variant_id",
        "selling_stock",
        "selling_price",
        "marketplace_seller_stock",
        "warehouse_stock",
        "created_at"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "image_src": "https://dkstatic-public-demo.digikala.com/digikala-products/8c65efa85d4dd5a0d763d6b0cba6a7cb2d26c9_1717921911.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "seller_id": 1234,
        "main_category_title": "هودی زنانه",
        "category_id": 12134,
        "product_id": 1234,
        "product_url": "https://demo.digikala.com/product/dkp-134/",
        "product_variant_id": 1234,
        "supplier_code": "123-c",
        "product_moderation_status": "edit_after_approved",
        "title": "هودی زنانه مدل تست رعنا ادیت سلر | ف| گارانتی سلامت فیزیکی کالا",
        "product_title": "هودی زنانه مدل تست رعنا ادیت سلر",
        "active": false,
        "lead_time": 3,
        "price_list": 2666800,
        "market_price_last_update": "2024-07-28 13:52:06",
        "price_type": "recommended",
        "selling_channel_site": "digikala",
        "price_sale": 2345600,
        "cash_selling_price": 2345600,
        "credit_selling_price": 2345600,
        "price_limit": 2,
        "initial_limit": 3,
        "credit_increase_percentage": 2345600,
        "maximum_credit_increase_percentage": 2345600,
        "marketplace_seller_stock": 12,
        "warehouse_stock": 1,
        "on_the_way_stock": 1,
        "reservation": 1,
        "left_consumer": 12,
        "maximum_per_order": 12,
        "allowed_count": 1,
        "ovl_selling_active": true,
        "created_at": "2023-12-30T19:21:33.000000+03:30",
        "pol_active": true,
        "b2b_params": {
          "seller_b2b_active": true,
          "is_only_b2b": false,
          "is_b2b_active": false
        },
        "max_lead_time": 3,
        "buy_box_price": 10000,
        "buy_box_badge_label": "string",
        "is_buy_box_winner": false,
        "is_sku_winner": true,
        "sku_config": {
          "color": "قرمز",
          "size": "XL",
          "themes": [
            {
              "theme_id": 34,
              "theme_value_id": 102746,
              "label": "وزن",
              "value": "2.5 گرم"
            }
          ]
        },
        "is_seller_buy_box_winner": false,
        "is_in_buy_box_challenge": false,
        "suppressed_until": "2024-12-31 23:59:59",
        "suppression_reason": "low_quality_score",
        "product_selling_chanel": {
          "active_digikala": true,
          "active_digistyle": false
        },
        "variant_selling_chanel": {
          "active_digikala": false,
          "active_digistyle": false
        },
        "is_in_incredible_promotion": false,
        "is_in_periodic_promotion": false,
        "is_in_promotion": false,
        "promotion_price": 10000,
        "shipping_nature_id": 1,
        "default_selling_chanel_code": 1,
        "rating": 1.5,
        "is_promotion_management_visible_for_seller": true,
        "is_archived": false,
        "fulfilment_and_delivery_cost": 164192,
        "seller_reservation": 1,
        "digikala_reservation": 1,
        "seller_shipping_lead_time": 1,
        "theme_values": [
          {
            "themeId": 37,
            "themeLabel": "Color",
            "active": true,
            "themeType": "colored",
            "themeValue": {
              "id": 22,
              "titleFa": "پوست پیازی",
              "titleEn": "پوست پیازی",
              "value": {
                "hex": "#c48a89",
                "rgb": "rgb(196,138,137)",
                "value": "14"
              },
              "nature": "color",
              "active": true,
              "standardUnitID": null,
              "colorPallateIDs": null,
              "extraData": {}
            }
          }
        ],
        "shipping_options": {
          "is_fbs_ability_enable": true,
          "is_fbd_active": true,
          "is_fbs_active": false,
          "is_needed_fbs_setting": false,
          "is_sbs_module_active": true,
          "only_sbs": false,
          "is_three_hour_delivery_active": false,
          "is_three_hour_checkbox_active": true
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/{variant_id}
Scopes => variant

Get Product Variant data
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 12345,
    "image_src": "https://dkstatic-public-demo.digikala.com/digikala-products/8c65efa85d4dd5a0d763d6b0cba6a7cb2d26c9_1717921911.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
    "seller_id": 1234,
    "main_category_title": "هودی زنانه",
    "category_id": 12134,
    "product_id": 1234,
    "product_url": "https://demo.digikala.com/product/dkp-134/",
    "product_variant_id": 1234,
    "supplier_code": "123-c",
    "product_moderation_status": "edit_after_approved",
    "title": "هودی زنانه مدل تست رعنا ادیت سلر | ف| گارانتی سلامت فیزیکی کالا",
    "product_title": "هودی زنانه مدل تست رعنا ادیت سلر",
    "active": false,
    "lead_time": 3,
    "price_list": 2666800,
    "market_price_last_update": "2024-07-28 13:52:06",
    "price_type": "recommended",
    "selling_channel_site": "digikala",
    "price_sale": 2345600,
    "cash_selling_price": 2345600,
    "credit_selling_price": 2345600,
    "price_limit": 2,
    "initial_limit": 3,
    "credit_increase_percentage": 2345600,
    "maximum_credit_increase_percentage": 2345600,
    "marketplace_seller_stock": 12,
    "warehouse_stock": 1,
    "on_the_way_stock": 1,
    "reservation": 1,
    "left_consumer": 12,
    "maximum_per_order": 12,
    "allowed_count": 1,
    "ovl_selling_active": true,
    "created_at": "2023-12-30T19:21:33.000000+03:30",
    "pol_active": true,
    "b2b_params": {
      "seller_b2b_active": true,
      "is_only_b2b": false,
      "is_b2b_active": false
    },
    "max_lead_time": 3,
    "buy_box_price": 10000,
    "buy_box_badge_label": "string",
    "is_buy_box_winner": false,
    "is_sku_winner": true,
    "sku_config": {
      "color": "قرمز",
      "size": "XL",
      "themes": [
        {
          "theme_id": 34,
          "theme_value_id": 102746,
          "label": "وزن",
          "value": "2.5 گرم"
        }
      ]
    },
    "is_seller_buy_box_winner": false,
    "is_in_buy_box_challenge": false,
    "suppressed_until": "2024-12-31 23:59:59",
    "suppression_reason": "low_quality_score",
    "product_selling_chanel": {
      "active_digikala": true,
      "active_digistyle": false
    },
    "variant_selling_chanel": {
      "active_digikala": false,
      "active_digistyle": false
    },
    "is_in_incredible_promotion": false,
    "is_in_periodic_promotion": false,
    "is_in_promotion": false,
    "promotion_price": 10000,
    "shipping_nature_id": 1,
    "default_selling_chanel_code": 1,
    "rating": 1.5,
    "is_promotion_management_visible_for_seller": true,
    "is_archived": false,
    "fulfilment_and_delivery_cost": 164192,
    "seller_reservation": 1,
    "digikala_reservation": 1,
    "seller_shipping_lead_time": 1,
    "theme_values": [
      {
        "themeId": 37,
        "themeLabel": "Color",
        "active": true,
        "themeType": "colored",
        "themeValue": {
          "id": 22,
          "titleFa": "پوست پیازی",
          "titleEn": "پوست پیازی",
          "value": {
            "hex": "#c48a89",
            "rgb": "rgb(196,138,137)",
            "value": "14"
          },
          "nature": "color",
          "active": true,
          "standardUnitID": null,
          "colorPallateIDs": null,
          "extraData": {}
        }
      }
    ],
    "shipping_options": {
      "is_fbs_ability_enable": true,
      "is_fbd_active": true,
      "is_fbs_active": false,
      "is_needed_fbs_setting": false,
      "is_sbs_module_active": true,
      "only_sbs": false,
      "is_three_hour_delivery_active": false,
      "is_three_hour_checkbox_active": true
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/{variant_id}
Scopes => variant

Edit seller variant data.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

id of variant
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "seller_stock": 123,
  "maximum_per_order": 123,
  "selling_price": 123,
  "price_limit": 2,
  "credit_increase_percentage": 25,
  "shipping_type": "digikala",
  "lead_time": 1,
  "seller_lead_time": 24,
  "activation": true,
  "three_hour_delivery": false
}

Responses
Code	Description	Links
200	

UpdateProductVariantForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 12345,
    "image_src": "https://dkstatic-public-demo.digikala.com/digikala-products/8c65efa85d4dd5a0d763d6b0cba6a7cb2d26c9_1717921911.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
    "seller_id": 1234,
    "main_category_title": "هودی زنانه",
    "category_id": 12134,
    "product_id": 1234,
    "product_url": "https://demo.digikala.com/product/dkp-134/",
    "product_variant_id": 1234,
    "supplier_code": "123-c",
    "product_moderation_status": "edit_after_approved",
    "title": "هودی زنانه مدل تست رعنا ادیت سلر | ف| گارانتی سلامت فیزیکی کالا",
    "product_title": "هودی زنانه مدل تست رعنا ادیت سلر",
    "active": false,
    "lead_time": 3,
    "price_list": 2666800,
    "market_price_last_update": "2024-07-28 13:52:06",
    "price_type": "recommended",
    "selling_channel_site": "digikala",
    "price_sale": 2345600,
    "marketplace_seller_stock": 12,
    "warehouse_stock": 1,
    "on_the_way_stock": 1,
    "reservation": 1,
    "left_consumer": 12,
    "maximum_per_order": 12,
    "allowed_count": 1,
    "ovl_selling_active": true,
    "b2b_params": {
      "seller_b2b_active": true,
      "is_only_b2b": false,
      "is_b2b_active": false
    },
    "max_lead_time": 3,
    "buy_box_price": 10000,
    "is_buy_box_winner": false,
    "is_seller_buy_box_winner": false,
    "is_in_buy_box_challenge": false,
    "min_selling_price_limit": 1000,
    "price_limit": 10,
    "credit_increase_percentage": 10,
    "product_selling_chanel": {
      "active_digikala": true,
      "active_digistyle": false
    },
    "variant_selling_chanel": {
      "active_digikala": false,
      "active_digistyle": false
    },
    "is_in_incredible_promotion": false,
    "is_in_periodic_promotion": false,
    "is_in_promotion": false,
    "promotion_price": 10000,
    "shipping_nature_id": 1,
    "default_selling_chanel_code": 1,
    "rating": 1.5,
    "is_promotion_management_visible_for_seller": true,
    "is_archived": false,
    "fulfilment_and_delivery_cost": 164192,
    "seller_reservation": 1,
    "digikala_reservation": 1,
    "seller_shipping_lead_time": 1,
    "shipping_options": {
      "is_fbs_ability_enable": true,
      "is_fbd_active": true,
      "is_fbs_active": false,
      "is_needed_fbs_setting": false,
      "is_sbs_module_active": true,
      "only_sbs": false,
      "is_three_hour_delivery_active": false
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/b2b-activation
Scopes => variant

Activate B2B on seller variants
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variant_ids": [
    123,
    456,
    789
  ]
}

Responses
Code	Description	Links
200	

ActivateProductVariantsB2BForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_ids": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/variants​/export
Scopes => variant

Send an Excel file of Variant List filtered by RequestBody data to Seller Email
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "id": 123,
  "shipping_type": "digikala",
  "active": true,
  "moderation_status": "in_review",
  "category_ids": "123,456,789",
  "buy_box_winner": true,
  "in_competition": true,
  "search_term": "سلام",
  "price_terms": "???",
  "out_of_stock": true,
  "archived": true,
  "selling_channel": "digikala"
}

Responses
Code	Description	Links
200	

ProductConfigExcelExportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "لینک گزارش درخواستی تا دقایقی دیگر به ایمیل ثبت شده‌ی شما ارسال می‌شود."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/{variant_id}​/gold
Scopes => variant

Gold Modal Data for variant.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

variant id of a gold product
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantGoldModalObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "gold_wage": 12.34,
    "gold_profit": 12.34,
    "none_gold_wage": 12.34,
    "none_gold_cost": 12.34,
    "is_pure": false,
    "size": 1.2,
    "tax": 9,
    "live_gold_price": 10000000
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/{variant_id}​/gold
Scopes => variant

Edit seller variant gold data.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

gold product variant id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "gold_wage": 12.34,
  "gold_profit": 12.34,
  "none_gold_wage": 12.34,
  "none_gold_cost": 12.34,
  "order_limit": 12
}

Responses
Code	Description	Links
200	

UpdateProductVariantGoldModalForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "success",
    "did_b2b_deactivate": true
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "gold_profit": [
      "این قسمت نباید خالی باشد"
    ],
    "gold_wage": [
      "این قسمت نباید خالی باشد"
    ],
    "order_limit": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/{variant_id}​/price-calculator
Scopes => variant

Calculate price with live Gold Price for Variant.
Parameters
Try it out
Name	Description
variant_id *
(path)
	
gold_wage *
double
(query)
	

wage of gold part of the product
gold_profit *
double
(query)
	

profit of gold part of the product
none_gold_wage *
double
(query)
	

wage of non-gold part of the product
none_gold_cost *
double
(query)
	

cost of non-gold part of the product
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantGoldModalPriceCalculatorObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "price": {
      "variantId": 123455,
      "sellingPrice": 158218500,
      "isActive": true,
      "hasStock": true,
      "isWinnerBuyBox": true,
      "isGold": true
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "gold_profit": [
      "این قسمت نباید خالی باشد"
    ],
    "gold_wage": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/{variant_id}​/activation
Scopes => variant

Edit seller variant activation status.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

variant id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "activation": true
}

Responses
Code	Description	Links
200	

UpdateProductVariantActivationForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 12345,
    "image_src": "https://dkstatic-public-demo.digikala.com/digikala-products/8c65efa85d4dd5a0d763d6b0cba6a7cb2d26c9_1717921911.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
    "seller_id": 1234,
    "main_category_title": "هودی زنانه",
    "category_id": 12134,
    "product_id": 1234,
    "product_url": "https://demo.digikala.com/product/dkp-134/",
    "product_variant_id": 1234,
    "supplier_code": "123-c",
    "product_moderation_status": "edit_after_approved",
    "title": "هودی زنانه مدل تست رعنا ادیت سلر | ف| گارانتی سلامت فیزیکی کالا",
    "product_title": "هودی زنانه مدل تست رعنا ادیت سلر",
    "active": false,
    "lead_time": 3,
    "price_list": 2666800,
    "market_price_last_update": "2024-07-28 13:52:06",
    "price_type": "recommended",
    "selling_channel_site": "digikala",
    "price_sale": 2345600,
    "marketplace_seller_stock": 12,
    "warehouse_stock": 1,
    "on_the_way_stock": 1,
    "reservation": 1,
    "left_consumer": 12,
    "maximum_per_order": 12,
    "allowed_count": 1,
    "ovl_selling_active": true,
    "b2b_params": {
      "seller_b2b_active": true,
      "is_only_b2b": false,
      "is_b2b_active": false
    },
    "max_lead_time": 3,
    "buy_box_price": 10000,
    "is_buy_box_winner": false,
    "is_seller_buy_box_winner": false,
    "is_in_buy_box_challenge": false,
    "min_selling_price_limit": 1000,
    "product_selling_chanel": {
      "active_digikala": true,
      "active_digistyle": false
    },
    "variant_selling_chanel": {
      "active_digikala": false,
      "active_digistyle": false
    },
    "is_in_incredible_promotion": false,
    "is_in_periodic_promotion": false,
    "is_in_promotion": false,
    "promotion_price": 10000,
    "shipping_nature_id": 1,
    "default_selling_chanel_code": 1,
    "rating": 1.5,
    "is_promotion_management_visible_for_seller": true,
    "is_archived": false,
    "fulfilment_and_delivery_cost": 164192,
    "seller_reservation": 1,
    "digikala_reservation": 1,
    "seller_shipping_lead_time": 1,
    "shipping_options": {
      "is_fbs_ability_enable": true,
      "is_fbd_active": true,
      "is_fbs_active": false,
      "is_needed_fbs_setting": false,
      "is_sbs_module_active": true,
      "only_sbs": false,
      "is_three_hour_delivery_active": false
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "activation": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/{variant_id}​/b2b-prices
Scopes => variant

Get B2B Modal Data for Variant.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

variant id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantB2BModalObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "active": false,
    "buckets": [
      {
        "min": 1,
        "max": 10,
        "sellingPrice": 10000
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/{variant_id}​/b2b-prices
Scopes => variant

Edit seller variant b2b prices data.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

variant id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "active": true,
  "b2b_prices": {
    "min": 1,
    "max": 10,
    "selling_price": 10000
  }
}

Responses
Code	Description	Links
200	

UpdateProductVariantB2BPricesForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "b2b_prices": [
      "این قسمت نباید خالی باشد"
    ],
    "active": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/{variant_id}​/archive
Scopes => variant

Archive variant.
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

product variant id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "archive": true
}

Responses
Code	Description	Links
200	

ArchiveProductVariantForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/{variant_id}​/seller-stock
Scopes => variant

Get Detail of Variant Stock
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

product variant id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProductVariantStockObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "marketplace_seller_stock": 12,
    "warehouse_stock": 1,
    "on_the_way_stock": 1,
    "reservation": 1,
    "left_consumer": 12,
    "seller_reservation": 1,
    "digikala_reservation": 1
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/variants​/{variant_id}​/seller-stock
Scopes => variant

Update variant seller-stock amount
Parameters
Try it out
Name	Description
variant_id *
integer
(path)
	

seller variant Id
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "seller_stock": 10
}

Responses
Code	Description	Links
200	

UpdateVariantStockForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "selling_stock": 10,
    "marketplace_seller_stock": 10,
    "dk_warehouse_stock": 20,
    "digikala_reservation": 1,
    "seller_reservation": 5
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "seller_stock": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/variants​/selling-price
Scopes => variant

Update Product Variant Selling Price
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variant_id": 123,
  "selling_price": 123,
  "credit_increase_percentage": 25
}

Responses
Code	Description	Links
200	

UpdateVariantSellingPriceOpenAPIForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "variant_id": 12345,
    "selling_price": 2345600,
    "credit_increase_percentage": 25
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "selling_price": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Product Variant - Creation (11)
GET
​/open-api​/v1​/variants​/creation​/{product_id}
Scopes => variant

Use this api to get configurations and valid values to create variants
Parameters
Try it out
Name	Description
product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

VariantCreationValidatableObjectViewV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "warranty_options": [
      {
        "id": 272,
        "title": "گارانتی اصالت و سلامت فیزیکی کالا"
      }
    ],
    "lead_time_max": 2,
    "variant_theme": "sized",
    "global_error_message": "کالای موردنظر در وضعیت تایید شده نیست",
    "is_ship_by_seller_module_active": true,
    "is_only_sbs": false,
    "themes": [
      {
        "id": 1,
        "label": "سایز بالاتنه مردان",
        "themeType": "sized"
      }
    ],
    "dimension_config": {
      "length": {
        "min": 1,
        "max": 10
      },
      "width": {
        "min": 1,
        "max": 10
      },
      "height": {
        "min": 1,
        "max": 10
      },
      "weight": {
        "min": 1,
        "max": 10
      }
    },
    "gold_price_data": {
      "live_gold_price": 24550000,
      "tax": 0.09,
      "gold_wage_max_margin": 0.35,
      "profit_max_margin": 0.07,
      "is_pure_gold": false
    },
    "price": 5800000,
    "size_guide": {
      "config": [
        {
          "id": 6,
          "title": "عرض سینه",
          "unit": "سانتی‌متر",
          "min": null,
          "max": null
        }
      ],
      "is_required_on_create": true,
      "is_required_on_edit": true
    },
    "variant_photo_upload": {
      "can_upload": "no_image",
      "main_image_mandatory": false
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/variants​/creation​/{product_id}
Scopes => variant

Create New Product Variant
Parameters
Try it out
Name	Description
product_id *
integer
(path)
	

Product ID
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "is_active": true,
  "order_limit": 10,
  "marketplace_seller_stock": 10,
  "supplier_code": "sll_123",
  "price": 10000,
  "warranty_id": 10000,
  "site": "digikala",
  "shipping_type": "digikala",
  "lead_time": 10,
  "fbs_lead_time": 10,
  "three_hour_delivery": false,
  "color_id": 10,
  "size_id": 10,
  "package_width": 10,
  "package_height": 10,
  "package_length": 10,
  "package_weight": 10,
  "gold_price_parameters": {
    "gold_wage": 10,
    "gold_profit": 10,
    "non_gold_parts_wage": 10,
    "non_gold_parts_profit": 10
  },
  "sizes": {
    "id": "38",
    "value": 14
  },
  "photos_detail": {
    "id": "7bb851a67b6089654afb0b8a84d62752b76f2855_1766819085",
    "is_main": true
  },
  "theme_values": {
    "theme_id": 1,
    "theme_value_id": 5
  }
}

Responses
Code	Description	Links
200	

VariantCreationSaveFormV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 8468859,
    "is_active": true,
    "order_limit": 10,
    "site": "digikala",
    "marketplace_seller_stock": 10,
    "supplier_code": "sll_123",
    "price": 10000,
    "reference_price": 10000,
    "warranty_id": 10000,
    "shipping_type": "digikala",
    "shipping_type_seller": true,
    "lead_time": 10,
    "fbs_lead_time": 10,
    "color_id": 10,
    "size_id": 10,
    "package_width": 10,
    "package_height": 10,
    "package_length": 10,
    "package_weight": 10,
    "gold_price_parameters": {
      "gold_wage": 10,
      "gold_profit": 10,
      "non_gold_parts_wage": 10,
      "non_gold_parts_profit": 10
    },
    "size_attributes": [
      {
        "id": 38,
        "title": "طول آستین",
        "unit": "سانتی‌متر",
        "value": 14,
        "min": null,
        "max": null
      }
    ],
    "theme_values": [
      {
        "theme_id": 0,
        "theme_value_id": 0,
        "theme_label": "string",
        "themeValue": {
          "id": 0,
          "value": "string",
          "meta": {}
        }
      }
    ],
    "warnings": [
      {
        "code": "E5",
        "message": "string",
        "cta": {
          "type": "variant_photo_upload",
          "product_id": 0,
          "color_id": 0
        }
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ],
    "is_active": [
      "این قسمت نباید خالی باشد"
    ],
    "order_limit": [
      "این قسمت نباید خالی باشد"
    ],
    "marketplace_seller_stock": [
      "این قسمت نباید خالی باشد"
    ],
    "warranty_id": [
      "این قسمت نباید خالی باشد"
    ],
    "site": [
      "این قسمت نباید خالی باشد"
    ],
    "shipping_type": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/variants​/creation​/{product_id}​/{variant_id}
Scopes => variant

Edit Variant.
Parameters
Try it out
Name	Description
product_id *
integer
(path)
	

Product ID that owns variant.
variant_id *
integer
(path)
	

Variant ID to edit.
force_marketplace_seller_id
integer
(query)
	

Seller ID to edit on behalf of when caller has permission.
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "is_active": true,
  "order_limit": 10,
  "marketplace_seller_stock": 10,
  "supplier_code": "sll_123",
  "price": 100000,
  "site": "digikala",
  "shipping_type": "digikala",
  "lead_time": 10,
  "fbs_lead_time": 10,
  "package_width": 10,
  "package_height": 10,
  "package_length": 10,
  "package_weight": 10,
  "gold_price_parameters": {
    "gold_wage": 10.5,
    "gold_profit": 10.5,
    "non_gold_parts_wage": 10.5,
    "non_gold_parts_cost": 10.5
  },
  "auto_pricing_parameters": {
    "non_parts_wage": 10000,
    "non_parts_cost": 10000,
    "wage": 10000,
    "wage_pct": 10.5,
    "profit": 15.5
  },
  "sizes": {
    "id": "38",
    "value": 14
  },
  "photos_detail": {
    "id": "7bb851a67b6089654afb0b8a84d62752b76f2855_1766819085",
    "is_main": true
  },
  "three_hour_delivery": false
}

Responses
Code	Description	Links
200	

VariantCreationEditForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 8468860,
    "site": "digikala",
    "is_active": true,
    "order_limit": 10,
    "supplier_code": "sll_123",
    "marketplace_seller_stock": 10,
    "price": 100000,
    "reference_price": 120000,
    "shipping_type": "digikala",
    "shipping_type_seller": false,
    "lead_time": 10,
    "fbs_lead_time": 10,
    "package_width": 10,
    "package_height": 10,
    "package_length": 10,
    "package_weight": 10,
    "color_id": 10,
    "size_id": 20,
    "warranty_id": 30,
    "theme_values": [
      {
        "theme_id": 1,
        "theme_value_id": 10
      }
    ],
    "gold_price_parameters": {
      "gold_wage": 10.5,
      "gold_profit": 10.5,
      "non_gold_parts_wage": 10.5,
      "non_gold_parts_cost": 10.5
    },
    "auto_pricing_parameters": {
      "carat": 18,
      "non_parts_cost": 10000,
      "non_parts_wage": 10000,
      "wage": 10000,
      "wage_pct": 10.5,
      "profit": 15.5,
      "size": 2.5,
      "tax": 10,
      "trigger_price": 100000,
      "is_pure": false
    },
    "size_attributes": [
      {
        "id": 38,
        "title": "Length",
        "unit": "cm",
        "min": 10,
        "max": 100
      }
    ],
    "is_three_hour_delivery_active": false,
    "is_three_hour_checkbox_active": true,
    "seller_lead_times": [
      24,
      48
    ],
    "photos_detail": [
      {}
    ]
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "price": [
      "Price must be an integer."
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/creation​/images​/moderation
Scopes => variant

Get product moderation images with filters and pagination.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
product_id
integer
(query)
	

Filter by product id.
color_id
integer
(query)
	

Filter by color id.
moderation_status
string
(query)
	

Filter by moderation status.

Available values : pending, reject, accept
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ModerationImagesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": "123456",
        "product": {
          "id": 987654,
          "title": "پیراهن مردانه"
        },
        "color": {
          "id": 12,
          "title": "آبی",
          "hex": "#1E90FF"
        },
        "moderation_status": "pending",
        "image_url": "https://dkstatics-public.digikala.com/digikala-products/example.jpg",
        "thumb_url": "https://dkstatics-public.digikala.com/digikala-products/example-300x300.jpg",
        "is_main": true,
        "is_product_photo": false,
        "rejection_reason_ids": [
          4,
          7
        ],
        "comment": "تصویر تار است"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/creation​/images​/rejection-reasons
Scopes => variant

Get all active rejection reasons for product variant images, ordered by their display order.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

RejectionReasonsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "items": [
      {
        "id": 4,
        "title": "کیفیت پایین تصویر",
        "description": "توضیحات علت رد تصویر",
        "tooltip": "تصویر باید واضح باشد",
        "icon": 2,
        "order": 1
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/creation​/images​/{product_id}
Scopes => variant

Get all images of a product; each item includes its color_id, if attached to a color variant.
Parameters
Try it out
Name	Description
product_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

VariantPhotosListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "items": [
      {
        "id": "123456",
        "image_url": "https://dkstatics-public.digikala.com/digikala-products/example.jpg",
        "thumb_url": "https://dkstatics-public.digikala.com/digikala-products/example-300x300.jpg",
        "color_id": 12,
        "is_main": true
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/creation​/size​/types
Scopes => variant

Get All Available Size Types for Variant Creation
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SizeTypesListViewV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "sizeType": "age"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/variants​/creation​/size​/request
Scopes => variant

Request for a new Size.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "product_id": 8468859,
  "title": "XXXXXXXL",
  "theme_id": 1
}

Responses
Code	Description	Links
200	

SizeRequestFormV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 8468859
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ],
    "title": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/variants​/creation​/color​/request
Scopes => variant

Request for a new Color.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "product_id": 8468859,
  "title": "آبی نفتی",
  "product_image_id": "XDE3D",
  "hex_code": "#FFFFFF",
  "theme_id": 1
}

Responses
Code	Description	Links
200	

ColorRequestFormV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 8468859
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ],
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "product_image_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/variants​/creation​/warranty​/request
Scopes => variant

Request for a new Warranty.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "product_id": 8468859,
  "warranty_title": "گارانتی اصالت و سلامت ۱۸ ماهه",
  "warranty_period": 18,
  "warranty_image_id_1": "XBS7J",
  "warranty_image_id_2": "XBS7J",
  "has_insurance": true,
  "insurance_title": "بیمه ما",
  "insurance_period": 18,
  "insurance_image_id_1": "XBS7J",
  "insurance_image_id_2": "XBS7J"
}

Responses
Code	Description	Links
200	

WarrantyRequestFormV3
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 8468859
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_id": [
      "این قسمت نباید خالی باشد"
    ],
    "warranty_title": [
      "این قسمت نباید خالی باشد"
    ],
    "warranty_period": [
      "این قسمت نباید خالی باشد"
    ],
    "warranty_image_id_1": [
      "این قسمت نباید خالی باشد"
    ],
    "has_insurance": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/creation​/themes​/{theme_id}​/theme-values
Scopes => variant

Get List of Theme Values of Product to Create Variant
Parameters
Try it out
Name	Description
theme_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
product_id
integer
(query)
	

product id — optional; when omitted, category_id is required and size-validity filtering is skipped
category_id
integer
(query)
	

category id
brand_id
integer
(query)
	

brand id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ThemeValuesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1,
        "titleFa": "XL",
        "titleEn": "XL",
        "value": {
          "hex": "#000000",
          "rgb": "0,0,0",
          "value": "XL"
        },
        "nature": "aplha",
        "active": true,
        "standardUnitID": 0,
        "colorPallateIDs": [
          0
        ],
        "extraData": [
          {}
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Inventories (4)
GET
​/open-api​/v1​/inventories
Scopes => inventory

Get Inventories
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[stock_status]
string
(query)
	

Available values : has_warehouse_stock, has_not_warehouse_stock, has_marketplace_seller_stock, has_not_marketplace_seller_stock, soon_out_of_stock
search[selling_stock]
integer
(query)
	

selling stock must be 0, 1
search[active]
integer
(query)
	

active must be 0, 1
search[category_ids]
integer
(query)
	

category ids
search[search_field]
string
(query)
	

search filed must {product_id, product_variant_id and serial}
search[product_filter]
string
(query)
	

Available values : has_dead_stock, active, inactive
search[warehouse_filter]
string
(query)
	

Available values : 1, 50, 28, 48, others
search[calculate_available_stock]
boolean
(query)
	

calculate real available stock
search[over_30_days]
integer
(query)
	

filter available stock by stocks age
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInventoriesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "category_title": "هودی زنانه",
        "supplier_code": "s1",
        "product_id": 1234,
        "product_variant_id": 132455,
        "title": "هودی زنانه مدل تست رعنا ادیت سلر | فری سایز (42-46) | گارانتی سلامت فیزیکی کالا",
        "marketplace_seller_stock": 10,
        "warehouse_stock": 1,
        "available": 10,
        "reserve": 1,
        "warehouse": [
          123
        ],
        "img_src": "http://dkstatic-public-demo.digikala.com/digikala-products/8c6efa85d5a0d763d6b0cba6a7cb2d26c9_1717921911.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "shipping_nature": "کوچک",
        "shipping_nature_id": 1,
        "product_url": "http://digikala.com/product/dkp-11234/",
        "supply_stock": 1,
        "has_rts_package": false,
        "has_dead_stock": false,
        "hasRtsStock": false,
        "has_checkbox_for_rts": false
      }
    ],
    "meta_data": {
      "categories": {
        "114": "کتاب آموزش عکاسی و راهنمای دوربین",
        "150": "فیلم سینمایی",
        "152": "کتاب صوتی",
        "5695": "مجموعه آموزشی",
        "5880": "باتری استاندارد",
        "5912": "حقوق و مدیریت",
        "5919": "مجلات خارجی",
        "5980": "خودکار و روان نویس",
        "6029": "بازی فکری",
        "6030": "بازی آموزشی",
        "6035": "پازل",
        "6084": "مجلات داخلی",
        "6129": "تجهیزات جانبی سفر و کمپینگ",
        "6238": "سالنامه",
        "6305": "کاسه و پیاله",
        "8934": "منبت کاری",
        "9277": "پیکسل",
        "9335": "هودی زنانه",
        "9529": "ساعت عقربه ای مردانه",
        "9558": "ساعت عقربه ای زنانه و مردانه",
        "9882": "نقشه چاپی",
        "9908": "کفش روزمره زنانه",
        "10143": "کتاب چاپی غیر فارسی",
        "10490": "کتاب کودک و نوجوان",
        "10553": "کتاب زندگینامه و دایره المعارف",
        "10554": "کتاب علوم کاربردی، تکنولوژی و مهندسی",
        "10556": "کتاب تاریخ و جغرافیا",
        "10557": "کتاب فلسفه و روانشناسی",
        "10558": "کتاب درسی، کمک‌درسی و آزمون",
        "10559": "کتاب زبان",
        "10560": "کتاب هنر و سرگرمی",
        "10561": "کتاب دینی",
        "10562": "کتاب علوم اجتماعی",
        "10563": "کتاب شعر و ادبیات"
      },
      "items_has_rts": true,
      "warehouses": {
        "1": "انبار دانش",
        "28": "انبار مرجوعی مرکزی",
        "48": "انبار مرجوعی لارج",
        "50": "انبار بادامک",
        "others": "سایر"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/inventories​/{product_variant_id}
Scopes => inventory

Get Inventories Dead Stock.
Parameters
Try it out
Name	Description
product_variant_id *
(path)
	
search serial
string
(query)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInventoriesDeadStockListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "item_serial": "6FEA3192",
        "age": 1,
        "is_passed_discount_period": "خیر",
        "discount_period": 30,
        "current_warehouse_title": "انبار دانش"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/inventories​/{product_variant_id}​/export
Scopes => inventory

Export product variant inventory detail
Parameters
Try it out
Name	Description
product_variant_id *
(path)
	
search[product_variant_id]
integer
(query)
	
search[serial]
string
(query)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInventoriesDetailExcelExportView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "fileName": "excel2323.xlsx",
    "excelFile": "(binary)"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "product_variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/inventories​/export
Scopes => inventory

Send an Excel file to Seller about his/her Inventory Data
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "stock_status": "has_warehouse_stock",
  "selling_stock": "0",
  "active": "0",
  "category_id": 123,
  "search_field": 123,
  "product_filter": "has_dead_stock",
  "warehouse_filter": 1
}

Responses
Code	Description	Links
200	

SellerInventoriesExcelExportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "لینک گزارش درخواستی تا دقایقی دیگر به ایمیل ثبت شده‌ی شما ارسال می‌شود."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Package (10)
GET
​/open-api​/v1​/packages
Scopes => package

list of seller packages
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : id, created_at

Default value : created_at
order
string
(query)
	

Define list sort order.

Default value : desc
search[multi_search]
string,integer
(query)
	

searching in package number or serial or supplier_code or package status
search[type]
string,enum
(query)
	

type of package

Available values : order_fulfilment, consignment
search[status]
string,enum
(query)
	

Available values : new, received, partially_received, rejected, error, deleted
search[delivery_type]
string,enum
(query)
	

delivery type of package

Available values : seller, digikala, mobile_hub, post, compensation, retail_consignment
search[package_created_at_from]
string
(query)
	

created at of package from(na baba!!) in js iso format
search[package_created_at_to]
string
(query)
	

created at of package ins iso format
search[package_received_at_from]
string
(query)
	

created at of package from(na baba!!) in js iso format
search[package_received_at_to]
string
(query)
	

received at of package ins iso format(ghavi)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PackageListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "created_at",
      "sort_order": "desc",
      "sort_columns": [
        "id",
        "created_at"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "package_id": 0,
        "package_number": "910551301223010",
        "type": {
          "key": "order_fulfilment",
          "title": "سفارش"
        },
        "shipping_nature": {
          "key": "small",
          "title": "کوچک"
        },
        "status": {
          "key": "new",
          "title": "آماده ارسال/تحویل"
        },
        "delivery_type": {
          "key": "mobile_hub",
          "title": "نحویل به انبار سیار"
        },
        "created_at": "2023-12-30T19:21:33.000000+03:30",
        "received_at_forecast": "2023-12-30T19:21:33.000000+03:30",
        "received_at": "2023-12-30T19:21:33.000000+03:30",
        "effective_received_date": "2023-12-30T19:21:33.000000+03:30",
        "warehouse": {
          "id": 0,
          "title": "string"
        },
        "is_shippable_by_dk": true,
        "time_cope": {
          "start": 12,
          "end": 13
        },
        "can_delete": true,
        "show_print_label_package": true,
        "show_print_label_serials": true,
        "show_print_receive_receipt": true,
        "package_label_html_uri": "/package/printpackageitemseriallabel/public?hashedPackageId=205117951326",
        "package_label_pdf_uri": "/package/printpackageitemseriallabel/public?hashedPackageId=205117951326&just-print=1"
      }
    ],
    "meta_data": {
      "filters": {
        "package_delivery_types": [
          {
            "key": "string",
            "title": "string"
          }
        ],
        "package_types": [
          {
            "key": "string",
            "title": "string"
          }
        ],
        "package_statuses": [
          {
            "key": "string",
            "title": "string"
          }
        ]
      },
      "is_shipment_allowed": true
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/packages
Scopes => package
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "packages": {
    "1": {
      "items": [
        {
          "variant_id": "46461903",
          "count": "1"
        }
      ],
      "shipping_date": "2023-09-26T20:29:59.999Z",
      "delivery_type": "seller",
      "address_id": 1234,
      "capacity_id": 5678
    }
  },
  "package_type": "consignment"
}

Responses
Code	Description	Links
200	

SellerCreatePackageForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "package_creation": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/packages​/warehouses
Scopes => package

For getting warehouses based on delivery type
Parameters
Try it out
Name	Description
delivery_type
string,enum
(query)
	

delivery type that is chosen by seller

Available values : seller, digikala, mobile_hub, post, compensation, retail_consignment
shipping_nature_id
integer,enum
(query)
	

shipping nature of package

Available values : 1, 2
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PackageWarehousesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1234,
        "title": "انبار سیار شماره ۱",
        "address": "تهران، بزرگراه ارتش",
        "postal_code": "1378123123",
        "latitude": "35.79412",
        "longitude": "51.52123"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/packages​/warehouses​/availabilities
Scopes => package

Date-first warehouse listing: every warehouse/hub the seller can use, across all their enabled delivery types and shipping natures, annotated per combination with has_available_slot for the given date.
Parameters
Try it out
Name	Description
date *
string
(query)
	

forecast date (ISO string)
variants
string
(query)
	

comma separated variant ids being packaged; when given together with counts, has_available_slot reflects whether that many items actually fit instead of just any room at all
counts
string
(query)
	

comma separated count per variant id, same order as variants
past_and_today_counts
string
(query)
	

optional; comma separated count per variant id, same order as variants, restricted to the portion of counts already due (not yet-committed for a future date). When given, has_available_slot_for_past_and_today/slots[].disabled_for_past_and_today additionally reflect availability against this reduced total, alongside has_available_slot/slots[].disabled which always reflect the full counts -- lets the UI flag a slot as bookable only if the seller reduces to the due-now amount. Doesn't affect price or the counts reported elsewhere.
package_type
string,enum
(query)
	

optional; for the seller delivery type, narrows each row's slots/has_available_slot to only this package type's capacity instead of merging consignment and cross_dock together

Available values : order_fulfilment, consignment
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PackageWarehousesByDateListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1234,
        "title": "انبار سیار شماره ۱",
        "address": "تهران، بزرگراه ارتش",
        "postal_code": "1378123123",
        "latitude": "35.79412",
        "longitude": "51.52123",
        "delivery_type": "seller",
        "shipping_nature_id": 1,
        "has_available_slot": true,
        "has_available_slot_for_past_and_today": true,
        "price": 45230.5,
        "slots": [
          {
            "capacity_id": 1234,
            "starts_at": 10,
            "ends_at": 12,
            "date": "2023-12-26T15:35:25.000000+03:30",
            "remained_size_chunk": 123,
            "disabled": false,
            "disabled_for_past_and_today": false
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/packages​/warehouses​/{warehouse_id}​/capacities
Scopes => package

This API used for getting capacity of warehouse (method is POST to support up to 1000 variant ids per call)
Parameters
Try it out
Name	Description
warehouse_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variants": [
    1234
  ],
  "counts": [
    2
  ]
}

Responses
Code	Description	Links
200	

PackageWarehouseCapacitiesObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "capacities": [
      {
        "capacity_id": 1234,
        "starts_at": 10,
        "ends_at": 12,
        "date": "2023-12-26T15:35:25.000000+03:30",
        "remained_size_chunk": 123,
        "disabled": false
      }
    ],
    "price": "1230.00"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/packages​/{package_id}
Scopes => package

By this route, you will get a package object view.
Parameters
Try it out
Name	Description
package_id *
(path)
	
search[multi_search]
string
(query)
	

for search on product variant id, supplier code and product id
search[status]
string,enum
(query)
	

comma seperated status for filter package item status

Available values : new, received, partially_received, rejected, deleted
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PackageDetailListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "package_products": [
          {
            "package_item_id": 1234,
            "title": "کتاب نازک | رنگ سبز",
            "dkp": 1234,
            "product_link": "https://digikala.com/product/dkp-1234",
            "dkpc": 1234,
            "delivered_count": 1234,
            "ordered_count": 1234,
            "supplier_code": "s01",
            "serials": [
              {
                "id": 1234,
                "serial": "6E776CD4",
                "expiration_date": "2023-12-26T15:35:25.000000+03:30",
                "production_date": "2023-12-26T15:35:25.000000+03:30",
                "status": {
                  "status en": "حذف شده"
                },
                "show_print_label_package": true
              }
            ],
            "image": "https://dkstatics-public.digikala.com/digikala-products/12345.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60\"",
            "status": {
              "status en": "حذف شده"
            }
          }
        ]
      }
    ],
    "meta_data": {
      "package_id": 1234,
      "package_number": "12355131123123123",
      "package_delivery_type": {
        "key": "digikala",
        "title": "توسط دیجی‌کالا"
      },
      "seller_created": true,
      "package_status": {
        "status": "حذف شده"
      },
      "package_received": {
        "date": "2023-12-26T15:35:25.000000+03:30",
        "warehouse": {
          "id": 1234,
          "title": "انبار شماره ۲"
        },
        "time_scope": {
          "start": 10,
          "end": 12
        }
      },
      "shipping_nature": {
        "shipping_nature_id": "کوچک"
      },
      "status_count": {
        "status": {
          "count": 12,
          "title": "حذف شده"
        }
      },
      "show_export_receipt": true,
      "package_label_html_uri": "/package/printpackageitemseriallabel/public?hashedPackageId=205117951326",
      "package_label_pdf_uri": "/package/printpackageitemseriallabel/public?hashedPackageId=205117951326&just-print=1"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/packages​/{package_id}
Scopes => package

By this route, you can delete package
Parameters
Try it out
Name	Description
package_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DeletePackageForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "packageId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/packages​/{package_id}​/excel​/export
Scopes => package
Parameters
Try it out
Name	Description
package_id *
(path)
	
search[multi_search]
string
(query)
	

field for search on product id, variant id, supplier code
search[status]
string,enum
(query)
	

comma seperated status for filter package item status

Available values : new, received, partially_received, rejected, deleted
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PackageDetailExcelExportView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "file_link": "string"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "packageId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/packages​/consignment​/variants
Scopes => package
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
variant_ids
string
(query)
	

comma seperated variant ids that seller want create package for them
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerCreateConsignmentPackageListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "shipping_nature_id": {
          "shipping_nature": {
            "key": "small",
            "title": "کوچک"
          },
          "shipping_nature_id": 1,
          "variants": [
            {
              "product_variant_id": 1234,
              "product_variant_title": "کتاب سبز | سبز",
              "product_image_url": "https://dkstatics-public.digikala.com/digikala-products/1234.jpg",
              "product_id": 1234,
              "shipping_nature": {
                "key": "small",
                "title": "کوچک"
              },
              "supplier_code": "sc123",
              "on_the_way_stock": 12,
              "dk_inventory": 12,
              "allowed_consignment_count": 12
            }
          ]
        }
      }
    ],
    "meta_data": {
      "package_infos": {
        "shipment_abilities": {
          "key": "string",
          "title": "string"
        }
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/variants​/packages​/consignment
Scopes => package
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : _id, sale_quantity

Default value : _id
order
string
(query)
	

Define list sort order.

Default value : desc
search[multi_search]
string
(query)
	

field for multi search on product_id or product_variant_id or supplier_code of variant
search[shipping_nature_id]
integer,enum
(query)
	

shipping nature of variant

Available values : 1, 3, 2
search[selected_variant_ids]
string
(query)
	

comma seperated variant ids that are selected
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ConsignmentListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "_id",
      "sort_order": "desc",
      "sort_columns": [
        "_id",
        "sale_quantity"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_variant_id": 1234,
        "product_variant_title": "کتاب سبز | سبز",
        "product_id": 1234,
        "link_to_product": "https://demo.digikala.com/product/dkp-12345",
        "product_image_url": "https://dkstatics-public.digikala.com/digikala-products/1234.jpg",
        "shipping_nature": {
          "key": "small",
          "title": "کوچک"
        },
        "supplier_code": "scs91",
        "on_the_way_stock": 12,
        "dk_inventory": 12,
        "allowed_count_consignment": 12
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Shipments (5)
GET
​/open-api​/v1​/shipments​/dk
Scopes => shipment

Get dk pickup seller's shipments
Parameters
Try it out
Name	Description
search[created_at_end]
Y-m-d\TH:i:s.uP
(query)
	

The end time of shipments creation
search[shipment_receive_at_start]
Y-m-d\TH:i:s.uP
(query)
	

The start time of shipments receive
search[shipment_receive_at_end]
Y-m-d\TH:i:s.uP
(query)
	

The end time of shipments receive
search[shipment_status]
string,enum
(query)
	

The shipment status. null means you want all status

Available values : new, received, partially_received, rejected, error
search[multi_search]
string
(query)
	

field for search on shipment number, serial, variant_id and supplier code
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DKPickupShipmentsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "shipment_id",
      "sort_order": "desc",
      "sort_columns": [
        "shipment_id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123,
        "shipment_number": "91055220824001",
        "created_at": "2023-12-26T15:35:25.000000+03:30",
        "pickup_warehouse_title": "انبار شماره ۲",
        "pickup_date": "2023-12-26T15:35:25.000000+03:30",
        "cost": 200000,
        "status": "new",
        "total_volume": 12,
        "total_weight": 12,
        "min_distance": 12,
        "can_delete": true
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipments​/dk
Scopes => shipment

create shipments.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "package_ids": [
    1234
  ],
  "warehouse_id": 1234,
  "pickup_date": "2024-08-23T20:29:59.999Z",
  "time_scope": "10-12"
}

Responses
Code	Description	Links
200	

CreateDKPickupShipmentForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Shipment created successfully",
    "shipment_entity": {
      "number": "123552201241234",
      "warehouse": "کاپا",
      "received_at_forecast_date": "2024-08-23T23:59:59.999000+03:30",
      "time_scope": "10-12"
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_creation": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/dk​/packages
Scopes => shipment
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
package_ids
string
(query)
	

comma seperated package ids
search[warehouse_id]
integer
(query)
	

warehouse_id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DKShipmentCreationPackagesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1234,
        "package_number": "123405512612123456",
        "shipment_type": {
          "key": "order_fulfilment",
          "title": "سفارش"
        },
        "shipping_nature": {
          "key": "small",
          "title": "کوچک"
        },
        "created_at": "2023-12-26T15:35:25.000000+03:30",
        "shipment_cost": 123000
      }
    ],
    "meta_data": {
      "warehouse": {
        "time_scopes": [
          "8-10",
          "10-12",
          "12-14",
          "14-16"
        ]
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/dk​/{shipment_id}
Scopes => shipment

Get dk pickup seller's shipments detail
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DKPickupShipmentObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123,
    "shipment_number": "91055220824001",
    "created_at": "2023-12-26T15:35:25.000000+03:30",
    "pickup_warehouse_title": "انبار شماره ۲",
    "pickup_date": "2023-12-26T15:35:25.000000+03:30",
    "cost": 200000,
    "status": "new",
    "total_volume": 12,
    "total_weight": 12,
    "min_distance": 12,
    "can_delete": true,
    "packages": {
      "package_id": {
        "id": 123,
        "package_number": "910551261123567",
        "type": {
          "key": "order_fulfilment",
          "title": "سفارش"
        },
        "shipping_nature": {
          "shipping_nature_id": "کوچک"
        },
        "create_date": "2023-12-26T15:35:25.000000+03:30",
        "estimated_pickup_date": "2023-12-26T15:35:25.000000+03:30",
        "status": {
          "key": "new",
          "title": "اماده ارسال/تحویل"
        }
      }
    },
    "packages_count": 12,
    "time_scope": {
      "start": 10,
      "end": 12
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipmentId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/shipments​/dk​/{shipment_id}
Scopes => shipment

delete shipments.
Parameters
Try it out
Name	Description
shipment_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DeleteDKPickupShipmentForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipmentId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Postex (12)
GET
​/open-api​/v1​/shipping-services​/postex-status
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexRegistrationStatusObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/user
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexRegisterObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/user
Scopes => sbs_shipment

Registering a seller on postex side
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/user​/info
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexUserInfoObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/wallet​/charge
Scopes => sbs_shipment

Wallet Charge for postex
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "amount": "230000",
  "order_shipment_ids": [
    1,
    2
  ],
  "callback_url": "https://demo-seller.digikala.com/callback_url"
}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/wallet​/balance
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexWalletBalanceObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/wallet​/transactions
Scopes => sbs_shipment

Getting Transaction List
Parameters
Try it out
Name	Description
type
string
(query)
	

type of transactions :deposit,withdrawal
from_date
datetime
(query)
	

from date (format YMD)
to_date
datetime
(query)
	

to date (format YMD)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexWalletTransactionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {}
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/wallet​/transactions​/{transaction_id}
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
transaction_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexTransactionObjectView
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "transaction_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/wallet​/verify
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

Undefined
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/token-status
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexTokenObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/parcels​/calculate-price
Scopes => sbs_shipment

Calculate price for a parcel
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "shipment_id": "222825721",
  "registration_method": "digiexpress",
  "ready_date": "2024-01-27T17:53:15.708Z",
  "warehouse_id": 212353,
  "added_services": {
    "label": false,
    "packaging": false,
    "sms_notification": true,
    "email_notification": true,
    "print_logo": false
  },
  "parcel": {
    "box_size_id": 16,
    "is_fragile": false,
    "is_liquid": false,
    "description": "",
    "variant_ids": [
      "28310645",
      "29591696"
    ],
    "quantities": {
      "28310645": "2",
      "29591696": "1"
    }
  }
}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/order​/{shipment_id}
Scopes => sbs_shipment
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PostexResumeParcelRegisterObjectView
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "order_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Drop Shipping (3)
POST
​/open-api​/v1​/shipping-services​/user​/register
Scopes => sbs_shipment

register new seller
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "otp": 12345
}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/send_otp
Scopes => sbs_shipment

send otp
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/parcels​/total-weight
Scopes => sbs_shipment

Calculate total weight (grams) for given variant_ids and their quantities. GET: variant_ids=50800585,70065200 and quantities=2,1 (same order) or quantities[50800585]=2&quantities[70065200]=1.
Parameters
Try it out
Name	Description
variant_ids *
string,array
(query)
	

Variant IDs: comma-separated (variant_ids=50800585,70065200) or array (variant_ids[]=1&variant_ids[]=2)
quantities *
string,object
(query)
	

Quantities: comma-separated in same order as variant_ids (quantities=2,1) or by id (quantities[50800585]=2&quantities[70065200]=1)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

DropShippingCalculateWeightObjectView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Shipping Services (11)
GET
​/open-api​/v1​/shipping-services​/boxes
Scopes => sbs_shipment

Get list of available shipping boxes. If shipment_id is provided, returns boxes suitable for that shipment volume.
Parameters
Try it out
Name	Description
shipment_id
integer
(query)
	

Optional shipment ID to filter boxes based on shipment volume. If provided, returns boxes with volume less than or equal to the required box for the shipment.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ShippingBoxesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1,
        "size_id": 1,
        "title": "کارتن سایز ( 30 * 20 * 15 )",
        "width": 30,
        "height": 20,
        "length": 15
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/order​/detail​/{order_id}
Scopes => sbs_shipment

Get Shipping Service order detail view
Parameters
Try it out
Name	Description
order_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ShippingServicesOrderDetailView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "order_id": 123456789,
    "order_shipment_id": 987654321,
    "created_at": "2025-01-15T10:30:00.000000+03:30",
    "promise_date": "2025-01-20",
    "city_name": "تهران",
    "state_name": "تهران",
    "shipment_type": "digiexpress",
    "count_variants_in_shipment": 3,
    "order_shipment_price": 500000,
    "shipment_status": "processing",
    "shipping_nature": {
      "title": "small",
      "text": "کوچک"
    },
    "shipping_service_order_detail": {
      "service": "digiexpress",
      "status": "در انتظار بسته‌بندی",
      "shipping_service_status": "packed",
      "parcel_info": [
        {
          "box_size_name": "کارتن سایز ( 30 * 20 * 15 )",
          "shipping_service_order_id": 123456,
          "shipping_service_shipment_id": 789012,
          "weight": 1500,
          "is_fragile": false,
          "is_liquid": false,
          "parcel_number": "P123456",
          "tracking_code": "TR123456789",
          "price": 50000,
          "variants": [
            {
              "product_variant_id": 12345,
              "title": "تیشرت مردانه",
              "image": "https://example.com/image.jpg",
              "quantity": 2
            }
          ],
          "is_printable": true
        }
      ],
      "pickup_start_date": "2025-01-20T08:00:00.000000+03:30",
      "pickup_end_date": "2025-01-20T18:00:00.000000+03:30",
      "total_price": 50000
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/shipping-services​/order​/cancel​/{shipment_id}
Scopes => sbs_shipment

register new order
Parameters
Try it out
Name	Description
shipment_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "registration_method": "digiexpress",
  "order_id": "222825721"
}

Responses
Code	Description	Links
200	

ShippingServiceCancelOrderForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status_code": 200,
    "success": true,
    "message": "Order canceled successfully"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/label​/{registration_method}​/{parcel_number}
Scopes => sbs_shipment

return a Pdf response for Sipping Service Label
Parameters
Try it out
Name	Description
registration_method *
(path)
	
parcel_number *
(path)
	
Content-Type *
(header)
	

Default value : application/pdf
Responses
Code	Description	Links
200	

pdf file
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/label-request
Scopes => sbs_shipment

Create a DigiExpress label request for one or many shipments
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "shipment_ids": [
    223441715
  ]
}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipping-services​/label-request​/{request_id}
Scopes => sbs_shipment

Get the progress and download link of a DigiExpress label request
Parameters
Try it out
Name	Description
request_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

OpenApiShippingServiceLabelRequestStatus
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "request_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/bulk-shipping-services​/bulk-packaging
Scopes => sbs_shipment

bulk packaging for shipments. When box_size_id is 19 (custom size), optional width, height, length (in cm) can be sent per parcel; they are stored in meta_data and used when sending to express. Each parcel may also carry an optional boolean is_suggestion_modified, saying whether the seller changed the parcel that was suggested to them; it is stored in meta_data and only ever counted.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "shipments_data": [
    {
      "0": {
        "shipment_id": "222825722",
        "parcel": [
          {
            "box_size_id": 1,
            "is_fragile": true,
            "is_liquid": false,
            "description": "Fragile items",
            "total_weight": "5000",
            "variant_ids": [
              28310650
            ],
            "quantities": {
              "28310650": 1
            }
          }
        ]
      },
      "shipment_id": "222825721",
      "parcel": [
        {
          "box_size_id": 1,
          "is_fragile": false,
          "is_liquid": false,
          "description": "",
          "total_weight": "34344",
          "is_suggestion_modified": false,
          "variant_ids": [
            28310645,
            28310641
          ],
          "quantities": {
            "28310641": 2,
            "28310645": 1
          }
        },
        {
          "box_size_id": 19,
          "is_fragile": false,
          "is_liquid": false,
          "description": "",
          "total_weight": "34344",
          "is_split": false,
          "width": 30,
          "height": 20,
          "length": 15,
          "variant_ids": [
            28310645,
            28310646,
            28310647
          ],
          "quantities": {
            "28310645": 1,
            "28310646": 2,
            "28310647": 1
          }
        }
      ]
    }
  ]
}

Responses
Code	Description	Links
200	

ShippingServicePackagingForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "success": true,
    "total_shipments": 10,
    "successful_count": 10,
    "failed_count": 0,
    "successful_shipments": [
      {
        "shipment_id": 123456789,
        "status": "success",
        "message": "Package created successfully"
      }
    ],
    "failed_shipments": [
      {
        "shipment_id": 987654321,
        "status": "failed",
        "error": "Validation failed",
        "error_code": "validation_error"
      }
    ],
    "message": "All shipments packaged successfully"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/bulk-shipping-services​/simple-packaging
Scopes => sbs_shipment

Simple bulk packaging for shipments - automatically extracts variants and quantities. When box_size_id is 19 (custom size), optional width, height, length (in cm) can be sent; they are stored in meta_data and used when sending to express.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "shipment_ids": [
    320956939,
    253382041
  ],
  "box_size_id": 1,
  "total_weight": 200,
  "width": null,
  "height": null,
  "length": null
}

Responses
Code	Description	Links
200	

ShippingServiceSimplePackagingForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "success": true,
    "total_shipments": 10,
    "successful_count": 10,
    "failed_count": 0,
    "successful_shipments": [
      {
        "shipment_id": 123456789,
        "status": "success",
        "message": "Package created successfully"
      }
    ],
    "failed_shipments": [
      {
        "shipment_id": 987654321,
        "status": "failed",
        "error": "Validation failed",
        "error_code": "validation_error"
      }
    ],
    "message": "All shipments packaged successfully"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/bulk-shipping-services​/pickup
Scopes => sbs_shipment

pickup request
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "pickup_method": "digiexpress",
  "shipment_ids": [
    "222825721"
  ],
  "warehouse_id": "232434",
  "ready_date_time": "2023-12-10T09:19:22.765Z",
  "amount": 20000
}

Responses
Code	Description	Links
200	

ShippingServiceBulkPickupForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "success": true,
    "message": "Pickup request processed successfully"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/bulk-shipping-services​/detail​/{shipment_ids}
Scopes => sbs_shipment

Get Shipping Service order detail view
Parameters
Try it out
Name	Description
shipment_ids *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ShippingServicesBulkOrderDetailView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "order_id": 123456789,
    "order_shipment_id": 987654321,
    "created_at": "2025-01-15T10:30:00.000000+03:30",
    "promise_date": "2025-01-20",
    "city_name": "تهران",
    "state_name": "تهران",
    "shipment_type": "digiexpress",
    "count_variants_in_shipment": 3,
    "order_shipment_price": 500000,
    "shipment_status": "processing",
    "shipping_nature": {
      "title": "small",
      "text": "کوچک"
    },
    "shipping_service_order_detail": {
      "service": "digiexpress",
      "is_cancellable": true,
      "service_infra_type": "standard",
      "status": "در انتظار بسته‌بندی",
      "shipping_service_status": "packed",
      "parcel_info": [
        {
          "box_size_name": "کارتن سایز ( 30 * 20 * 15 )",
          "shipping_service_order_id": 123456,
          "shipping_service_shipment_id": 789012,
          "weight": 1500,
          "is_fragile": false,
          "is_liquid": false,
          "parcel_number": "P123456",
          "tracking_code": "TR123456789",
          "price": 50000,
          "variants": [
            {
              "product_variant_id": 12345,
              "title": "تیشرت مردانه",
              "image": "https://example.com/image.jpg",
              "product_url": "https://www.digikala.com/product/dkp-12345/",
              "product_id": 12345,
              "quantity": 2
            }
          ],
          "is_printable": true
        }
      ],
      "pickup_start_date": "2025-01-20T08:00:00.000000+03:30",
      "pickup_end_date": "2025-01-20T18:00:00.000000+03:30",
      "total_price": 50000
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/bulk-shipping-services​/promise-date​/{shipment_ids}
Scopes => sbs_shipment

Get promise date
Parameters
Try it out
Name	Description
shipment_ids *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ShippingServicesBulkPromiseDateView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Post Tracking Code (2)
GET
​/open-api​/v1​/shipping-services​/excel​/post-tracking-sample
Scopes => sbs_shipment

Get a sample Excel file for importing post tracking codes.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SamplePostTrackingCodeExcelExportView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/import​/tracking-code
Scopes => sbs_shipment

By this route, You can set tracking codes by uploading an Excel file.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
SBS (3)
POST
​/open-api​/v1​/shipping-services​/parcels​/post-tracking-code​/bulk
Scopes => sbs_shipment

Generate tracking codes in batch mode
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_ids": [
    223441715
  ],
  "warehouse_id": 2
}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/parcels​/excel
Scopes => sbs_shipment

Get excel link of shipping requests
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_ids": [
    223441715
  ]
}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipping-services​/parcels​/cost
Scopes => sbs_shipment

View Of Shipping Requests Bulk Cost
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_ids": [
    223441715
  ],
  "warehouse_id": 2,
  "request_type": "postex_pickup,digi_express_pickup,generate_tracking_code"
}

Responses
Code	Description	Links
200	

ArrayApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
ShippingService (1)
POST
​/open-api​/v1​/bulk-shipping-services​/packaging
Scopes => sbs_shipment

register new order. When box_size_id is 19 (custom size), optional width, height, length (in cm) can be sent per parcel; they are stored in meta_data and used when sending to express.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "shipment_id": "222825721",
  "package_type": "digiexpress",
  "parcel": [
    {
      "box_size_id": 1,
      "is_fragile": false,
      "is_liquid": false,
      "description": "",
      "total_weight": "34344",
      "variant_ids": [
        28310645,
        28310641
      ],
      "quantities": {
        "28310641": 2,
        "28310645": 1
      }
    },
    {
      "box_size_id": 19,
      "is_fragile": false,
      "is_liquid": false,
      "description": "",
      "total_weight": "34344",
      "is_split": false,
      "width": 30,
      "height": 20,
      "length": 15,
      "variant_ids": [
        28310645,
        28310646,
        28310647
      ],
      "quantities": {
        "28310645": 1,
        "28310646": 2,
        "28310647": 1
      }
    }
  ]
}

Responses
Code	Description	Links
200	

MessageApiView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Order (4)
GET
​/open-api​/v1​/orders
Scopes => order

getting details of all active order items seller
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : order_created_at

Default value : order_created_at
order
string
(query)
	

Define list sort order.

Default value : desc
search[search_term]
string
(query)
	

Search in product title, variant id, or order id
search[created_today]
boolean
(query)
	

Filter to show only orders created today
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

AllSellerDigikalaOrderListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "order_created_at",
      "sort_order": "desc",
      "sort_columns": [
        "order_created_at"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_variant_id": 1234,
        "product_image_url": "http://dkstatics-public.digikala.com/digikala-products/c72042c9bb6b8795f6094e07837edf9f00_1613546028.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "product_variant_title": "کتاب | گارانتی اصالت و سلامت فیزیکی کالا",
        "supplier_code": "sc01",
        "order_id": 12345,
        "order_created_at": "2024-07-31T13:40:31.000000+04:30",
        "warehouse_status_at": "2024-07-31T13:45:03.000000+04:30",
        "commitment_date": "2024-08-04T00:00:00.000000+04:30",
        "quantity": 1,
        "selling_price": 645800,
        "amazing_discount": 1200,
        "discount_manager": 123,
        "total_price": 645800
      }
    ],
    "meta_data": {
      "cancellation_reasons": {
        "id": {
          "key": "string",
          "title": "string"
        }
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/orders​/statistics
Scopes => order

api for getting count of shipped by digikala and shipped by seller orders count
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerOrderStatisticsObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "all_shipped_by_dk": 123,
    "shipped_by_seller_count": 123,
    "seller_nearby_stores_order_count": 123
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/orders​/history
Scopes => order

Get history of all seller orders
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
order_type
string
(query)
	

Available values : processed, returned, canceled
category_id
integer
(query)
	
order_created_at_to
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
order_created_at_from
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
exit_from_warehouse_date_to
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
exit_from_warehouse_date_from
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
returned_to_warehouse_date_to
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
returned_to_warehouse_date_from
string
(query)
	

format -> Y-m-d\TH:i:s.v\Z
shipping_type
string
(query)
	

Available values : seller, digikala, nearby
search_text_all
string,integer
(query)
	

field for searching in serial, order_shipment_id, product_id, product_supplier_code or variant_id
b2b_active
boolean
(query)
	

be true if seller select it(shown if seller has b2b panel active)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

OrderHistoryListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_variant_title": "کامپیوتر همه کاره 24 اینچی مایا مدل MA24D 12M - i7 16GB 500SSD | مشکی | گارانتی 12 ماهه ماتریس",
        "product_id": 1234,
        "product_variant_id": 5443121,
        "order_id": 112736712,
        "shipment_id": 1231218721,
        "order_created_at": "2024-08-07T13:01:10+03:30",
        "order_status": {
          "key": "confirmed",
          "title": "نهایی شده"
        },
        "category": "کامپیوترهای All-in-One",
        "product_supplier_code": "123213",
        "product_url": "https://www.digikala.com/product/dkp-16006355/",
        "image_src": "https://dkstatics-public.digikala.com/digikala-products/01110fb7b45ba0b6313f9deaadea30767dc75547_1720431657.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "payment_type": {
          "key": "credit",
          "title": "اعتباری"
        },
        "sell_type": {
          "key": "b2b",
          "title": "سازمانی"
        },
        "shipping_type": {
          "key": "seller",
          "title": "فروشنده"
        },
        "unit_discount": 100000,
        "unit_price": 120000000,
        "lead_time": 3,
        "serials": {
          "serial": {
            "type": "string",
            "description": "Each object has a serial and it will be unique",
            "example": "A2134324"
          },
          "order_shipped_at": {
            "type": "string",
            "description": "The time that deliver picked serial from warehouse",
            "example": "2024-08-07T13:01:10+03:30"
          },
          "return_to_warehouse_at": {
            "type": "string",
            "description": "The time that serial returned to the warehouse",
            "example": "2024-08-07T13:01:10+03:30"
          },
          "warehouse_title": {
            "type": "string",
            "description": "warehouse title or seller",
            "example": "انبار دانش"
          },
          "serial_status": {
            "type": "json",
            "description": [
              "pending",
              "processing",
              "processed",
              "return_pending",
              "return_processing",
              "return_processed"
            ],
            "example": "processed"
          },
          "return_reason": {
            "type": "string",
            "description": "The reason for return to warehouse",
            "example": "خرابی کالا"
          }
        },
        "quantity": 5,
        "discount_type": "gift",
        "total_price": 30000000000,
        "cancellation_info": {
          "canceled_by": "seller",
          "reason": "موجودی کالا به اتمام رسیده"
        },
        "seller_voucher_title": "Voucher",
        "seller_voucher_amount": 10000000,
        "dual_price_tag": "قیمت تطبیق یافته",
        "extra_commission_tag": "کمیسیون اضافه"
      }
    ],
    "meta_data": {
      "all_categories": {
        "category_id": "موبایل"
      },
      "b2b_active": true
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/orders​/{order_item_id}
Scopes => order

used for cancelling order item of seller
Parameters
Try it out
Name	Description
order_item_id *
integer
(path)
	

id of order item that is going to be canceled
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "cancellation_reason_id": 123,
  "count": 123
}

Responses
Code	Description	Links
200	

SellerCancelDigikalaOrderItemForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "order was cancelled successfully",
    "status": "ok",
    "code": 200
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "orderItemId": [
      "این قسمت نباید خالی باشد"
    ],
    "cancellationReasonId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Commitments (5)
GET
​/open-api​/v1​/commitments
Scopes => order

List of seller commitments with enhanced product details. Supports filtering, sorting, and pagination with caching optimizations.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 25
sort
string
(query)
	

Define list sort column.

Available values : variant_id, commitment_count

Default value : variant_id
order
string
(query)
	

Define list sort order.

Default value : asc
search[multi_search]
string
(query)
	

Multi-field search across variant ID, product title, product ID, and supplier code
search[category_ids]
string,integer
(query)
	

Comma-separated category IDs for filtering commitments by product categories
search[shipping_nature_ids]
string,integer
(query)
	

Comma-separated shipping nature IDs. Filters commitments by package size/weight categories

Available values : 1, 3, 2
search[is_effective]
boolean
(query)
	

Filter for effective commitments (commitments that are active and relevant for today's performance date)

Default value : false
search[to_commitment_date]
string,date
(query)
	

for selecting orders whose commitment_date is on or before this date Y-M-D format
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CommitmentsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "variant_id",
      "sort_order": "asc",
      "sort_columns": [
        "variant_id",
        "commitment_count"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 25,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "sort_data": {
          "sort_column": "variant_id",
          "sort_order": "desc",
          "sort_columns": [
            "variant_id",
            "commitment_count"
          ]
        },
        "pager": {
          "page": 1,
          "item_per_page": 50,
          "total_pages": 1,
          "total_rows": 37
        },
        "form_data": {
          "is_past_and_today": "true",
          "to_commitment_date": "2025-09-28T20:30:00.000Z"
        },
        "items": [
          {
            "variantId": 72404094,
            "sellerId": 123123213,
            "brandId": 55,
            "productId": 741231234933,
            "categoryId": 951231229,
            "natureId": 1,
            "titleFa": "ساعت مچی عقربه‌ای مردانه کاسیو مدل  | گارانتی 12 ماهه پوزیترون",
            "supplierCode": "01422",
            "stock": {
              "warehouse": 0,
              "supply": 0,
              "onTheWay": 0,
              "stock": 0
            },
            "orders": 1,
            "commitment": {
              "nextDays": 0,
              "today": 1,
              "delayed": 0,
              "all": 1,
              "effective": 1
            },
            "onTheWay": 0,
            "product_image": "string",
            "product_link": "string",
            "natureLabel": "کوچک",
            "adverg_url": "string"
          }
        ],
        "meta_data": {
          "data_source": "commitments_api",
          "supported_filters": [
            "multi_search",
            "category_ids",
            "shipping_nature_ids",
            "is_effective",
            "to_commitment_date"
          ],
          "supported_sorting": [
            "variant_id",
            "commitment_count"
          ]
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/commitments​/metadata
Scopes => order

Get comprehensive metadata for the commitments page including summary statistics, categories, package configuration, calendar dates, and shipment abilities. This endpoint provides all necessary data for rendering the commitments dashboard.
Parameters
Try it out
Name	Description
commitment_date
string
(query)
	

Commitment date for effective commitments calculation and metadata generation (Y-m-d format). Defaults to today if not provided.

Default value : today
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CommitmentsMetadataView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "summary_statistics": {
      "totalCommitments": 150,
      "effectiveCommitments": 120,
      "nonEffectiveCommitments": 30,
      "totalPenalty": 2500000,
      "effectiveLastUpdated": "2024-01-15T14:30:00Z",
      "nonEffectiveLastUpdated": "2024-01-15T14:30:00Z"
    },
    "categories": {
      "25": "اسپیکر (بلندگو)",
      "1317": "USB هاب",
      "2402": "تصفیه کننده هوا",
      "9434": "ساعت دیجیتال زنان",
      "9529": "ساعت عقربه ای مردانه"
    },
    "package_config": {
      "small": "2025-10-09",
      "medium": "2025-10-09",
      "heavy": "2025-10-04"
    },
    "calendar_dates": {
      "start_date": "2024-01-01",
      "end_date": "2024-03-01",
      "today": "2024-01-15"
    },
    "commitment_dates": [
      "2024-12-25"
    ],
    "shipment_abilities": [
      {
        "key": "digikala",
        "title": "دیجی‌کالا",
        "is_active": true
      }
    ],
    "penaltyConfig": {
      "firstDay": 0.2,
      "secondDay": 0.5,
      "thirdDay": 1,
      "fourthDay": 0.1,
      "etc": 0.1
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/commitments​/export
Scopes => order

Excel Export API for Commitments data. Exports commitment data with enhanced product details including images, links, and nature labels.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "search": {
    "multi_search": "شلوار سفید",
    "category_ids": "123,456,789",
    "shipping_nature_ids": "1,2,3",
    "is_effective": true,
    "to_commitment_date": "2024-12-31"
  },
  "sort": "variant_id",
  "order": "asc"
}

Responses
Code	Description	Links
200	

CommitmentsExcelExportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "لینک گزارش درخواستی تا دقایقی دیگر به ایمیل ثبت شده‌ی شما ارسال می‌شود."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/commitments​/report​/export
Scopes => order

Excel Export API for Commitment Report data. Exports comprehensive commitment reports with penalty calculations and fulfillment statistics for a specified date range.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "fromDate": "2025-09-24",
  "toDate": "2025-01-15"
}

Responses
Code	Description	Links
200	

CommitmentReportExcelExportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "لینک گزارش درخواستی تا دقایقی دیگر به ایمیل ثبت شده‌ی شما ارسال می‌شود."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/commitments​/{variant_id}
Scopes => order

Get detailed commitment information for a specific product variant. Returns commitment history, product details, and enhanced metadata. The variant_id is passed as a URL parameter.
Parameters
Try it out
Name	Description
variant_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : commitment_date, quantity

Default value : commitment_date
order
string
(query)
	

Define list sort order.

Default value : asc
search[commitment_date]
string
(query)
	

Specific commitment date to filter by. If provided, this date will be used as the performance date for the API call
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CommitmentsDetailView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "sort_data": {
          "sort_column": "commitment_date",
          "sort_order": "asc",
          "sort_columns": [
            "commitment_date",
            "quantity"
          ]
        },
        "pager": {
          "page": 1,
          "item_per_page": 50,
          "total_pages": 0,
          "total_rows": 0
        },
        "form_data": {},
        "items": {
          "variantId": 72403758,
          "productId": 441703,
          "natureId": 1,
          "titleFa": "ساعت مچی عقربه‌ای کوارتز مردانه کاسیو مدل MTP-V004L-1AUDF | گارانتی 12 ماهه پوزیترون",
          "supplierCode": "00188",
          "stock": {
            "warehouse": 0,
            "supply": 0,
            "onTheWay": 0,
            "stock": 0
          },
          "onTheWay": 1,
          "orders": 2,
          "commitments": [
            {
              "commitmentDate": "2025-09-29",
              "type": "EFFECTIVE",
              "committed": 1,
              "penaltyUntilToday": 757760,
              "totalPenalty": 0
            }
          ],
          "product_image": "https://dkstatics-public.digikala.com/digikala-products/1878758.jpg?x-oss-process=image/resize,m_fill,h_150,w_150/quality,q_60",
          "product_link": "https://www.digikala.com/product/dkp-441703?seller-view-token=-...",
          "nature_label": "کوچک",
          "adverge_url": "https://seller.digikala.com/pwa/ad-service/search-ads"
        },
        "meta_data": {
          "variant_id": "72403758",
          "data_source": "commitments_api",
          "variant_details": {
            "id": 72403758,
            "supplier_code": "00188",
            "product_id": 441703
          }
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
SBS Settings (7)
POST
​/open-api​/v1​/shipments​/seller​/new-settings
Scopes => sbs_setting

Creates setting
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "type": "self_shipping",
  "name": "پیک موتوری به شهرهای اطراف",
  "cost": 60000,
  "free_shipping": {
    "cost": 10000000,
    "active": true
  },
  "nature_id": 1,
  "status": "inactive",
  "dynamic_time_scope_id": 1,
  "time_distance": 0,
  "first_mile_delivery_time": 3,
  "cities": [
    2
  ],
  "time_scopes": {
    "id": 1,
    "active": false,
    "capacity": 30
  },
  "coverages": {
    "id": 1,
    "cost": 30000,
    "polygon_ids": [
      101
    ]
  },
  "warehouse_id": 123,
  "pic_name": "علی احمدی",
  "pic_phone": "09123456789",
  "auto_approve_pending_orders": false
}

Responses
Code	Description	Links
200	

SBSSettingCreateForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1,
    "type": "self_shipping",
    "name": "ارسال با پیک موتوری",
    "status": "active",
    "cities_count": 3,
    "time_distance": 1,
    "first_mile_delivery_time": 3,
    "cost": 550000,
    "time_scope": "یک بازه‌ی دوازده ساعته",
    "total_capacity": 12,
    "free_shipping": {
      "active": "active",
      "cost": 100000000
    },
    "nature": {
      "id": 3,
      "title": "متوسط"
    },
    "dynamic_time_scope": {
      "id": 2,
      "period": 1,
      "start": 9,
      "end": 21,
      "title": "یک بازه‌ی دوازده ساعته",
      "slots": [
        {
          "id": 12,
          "starts_at": 9,
          "ends_at": 21,
          "active": true,
          "capacity": 12
        }
      ]
    },
    "pic": {
      "name": "علی احمدی",
      "phone": "09123456789"
    },
    "auto_approve_pending_orders": false,
    "coverage_prices": [
      30000,
      50000
    ],
    "coverages": [
      {
        "id": 1,
        "cost": 30000,
        "polygon_ids": [
          101
        ]
      }
    ],
    "warehouse_info": {
      "warehouse_id": 123,
      "latitude": 35.6892,
      "longitude": 51.389,
      "address": "پلاک 2",
      "title": "انبار اصلی"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/seller​/new-settings
Scopes => sbs_setting

List of seller's settings defined for SBS
Parameters
Try it out
Name	Description
search[status]
string
(query)
	

Filters settings list based on status value.

Available values : inactive, active, draft
search[search_term]
string
(query)
	

Filters settings list based on the search_term includes in their state/cities.
search[nature_id]
integer
(query)
	

Filters settings list based on the nature_id.\n 1 as small, 2 as large, and 3 as medium natures.

Available values : 1, 2, 3
search[type] *
string
(query)
	

Filters settings list based on shipping type.

Available values : self_shipping, partner_shipping
search[ids]
array
(query)
	

Filter settings with ids
size
integer
(query)
	

Defines the pagination size. The default is 50.
page
integer
(query)
	

Defines the page number. The default is 1.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSSettingListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1,
        "type": "self_shipping",
        "name": "ارسال با پیک موتوری",
        "status": "active",
        "cities_count": 3,
        "time_distance": 1,
        "first_mile_delivery_time": 3,
        "cost": 550000,
        "time_scope": "یک بازه‌ی دوازده ساعته",
        "total_capacity": 12,
        "free_shipping": {
          "active": "active",
          "cost": 100000000
        },
        "nature": {
          "id": 3,
          "title": "متوسط"
        },
        "dynamic_time_scope": {
          "id": 2,
          "period": 1,
          "start": 9,
          "end": 21,
          "title": "یک بازه‌ی دوازده ساعته",
          "slots": [
            {
              "id": 12,
              "starts_at": 9,
              "ends_at": 21,
              "active": true,
              "capacity": 12
            }
          ]
        },
        "pic": {
          "name": "علی احمدی",
          "phone": "09123456789"
        },
        "auto_approve_pending_orders": false,
        "coverage_prices": [
          30000,
          50000
        ],
        "coverages": [
          {
            "id": 1,
            "cost": 30000,
            "polygon_ids": [
              101
            ]
          }
        ],
        "warehouse_info": {
          "warehouse_id": 123,
          "latitude": 35.6892,
          "longitude": 51.389,
          "address": "پلاک 2",
          "title": "انبار اصلی"
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/shipments​/seller​/new-settings​/{id}
Scopes => sbs_setting

Edits setting details
Parameters
Try it out
Name	Description
id *
integer
(path)
	

The ID of the setting
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "name": "setting_title",
  "cost": 100000,
  "free_shipping": {
    "cost": 10000,
    "active": true
  },
  "nature_id": 1,
  "status": "active|inactive",
  "dynamic_time_scope_id": 1,
  "time_distance": 3,
  "cities": [
    4,
    5
  ],
  "time_scopes": [
    {
      "id": 2,
      "active": true,
      "capacity": 45
    }
  ],
  "coverages": [
    {
      "cost": 30000,
      "polygon_ids": [
        101,
        102
      ]
    }
  ],
  "warehouse_id": 123,
  "pic_name": "علی احمدی",
  "pic_phone": "09123456789",
  "auto_approve_pending_orders": false
}

Responses
Code	Description	Links
200	

SBSSettingEditForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1,
    "type": "self_shipping",
    "name": "ارسال با پیک موتوری",
    "status": "active",
    "cities_count": 3,
    "time_distance": 1,
    "first_mile_delivery_time": 3,
    "cost": 550000,
    "time_scope": "یک بازه‌ی دوازده ساعته",
    "total_capacity": 12,
    "free_shipping": {
      "active": "active",
      "cost": 100000000
    },
    "nature": {
      "id": 3,
      "title": "متوسط"
    },
    "dynamic_time_scope": {
      "id": 2,
      "period": 1,
      "start": 9,
      "end": 21,
      "title": "یک بازه‌ی دوازده ساعته",
      "slots": [
        {
          "id": 12,
          "starts_at": 9,
          "ends_at": 21,
          "active": true,
          "capacity": 12
        }
      ]
    },
    "pic": {
      "name": "علی احمدی",
      "phone": "09123456789"
    },
    "auto_approve_pending_orders": false,
    "coverage_prices": [
      30000,
      50000
    ],
    "coverages": [
      {
        "id": 1,
        "cost": 30000,
        "polygon_ids": [
          101
        ]
      }
    ],
    "warehouse_info": {
      "warehouse_id": 123,
      "latitude": 35.6892,
      "longitude": 51.389,
      "address": "پلاک 2",
      "title": "انبار اصلی"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/seller​/new-settings​/{id}
Scopes => sbs_setting

Returns details of given setting
Parameters
Try it out
Name	Description
id *
integer
(path)
	

The ID of the setting
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSSettingView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1,
    "type": "self_shipping",
    "name": "ارسال با پیک موتوری",
    "status": "active",
    "cities_count": 3,
    "time_distance": 1,
    "first_mile_delivery_time": 3,
    "cost": 550000,
    "time_scope": "یک بازه‌ی دوازده ساعته",
    "total_capacity": 12,
    "free_shipping": {
      "active": "active",
      "cost": 100000000
    },
    "nature": {
      "id": 3,
      "title": "متوسط"
    },
    "dynamic_time_scope": {
      "id": 2,
      "period": 1,
      "start": 9,
      "end": 21,
      "title": "یک بازه‌ی دوازده ساعته",
      "slots": [
        {
          "id": 12,
          "starts_at": 9,
          "ends_at": 21,
          "active": true,
          "capacity": 12
        }
      ]
    },
    "pic": {
      "name": "علی احمدی",
      "phone": "09123456789"
    },
    "auto_approve_pending_orders": false,
    "coverage_prices": [
      30000,
      50000
    ],
    "coverages": [
      {
        "id": 1,
        "cost": 30000,
        "polygon_ids": [
          101
        ]
      }
    ],
    "warehouse_info": {
      "warehouse_id": 123,
      "latitude": 35.6892,
      "longitude": 51.389,
      "address": "پلاک 2",
      "title": "انبار اصلی"
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/seller​/new-settings​/state
Scopes => sbs_setting

List of states needed to define setting
Parameters
Try it out
Name	Description
search[setting_id]
integer
(query)
	

Accepts the setting ID and returns the list of states and cities occupied by the setting.
search[nature_id] *
integer
(query)
	

Returns settings items filtered by nature id

Available values : 1, 2, 3
search[active]
integer
(query)
	

Returns settings items filtered by active status

Available values : 0, 1
search[text]
string
(query)
	

Accepts text to search for state or city
size
integer
(query)
	

Defines page size
page
integer
(query)
	

Defines page number
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSSettingStateListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "has_warehouse": [
          {
            "state_id": 1,
            "name": "تهران",
            "cities_count": 8,
            "selected_cities_count": 2,
            "selected_in_setting_cities_count": 2,
            "disabled": false,
            "cities": [
              {
                "state_id": 1,
                "city_id": 9,
                "name": "دماوند",
                "selected": false,
                "exist_in_other_settings": true
              }
            ]
          }
        ],
        "around_warehouse": [
          {
            "state_id": 1,
            "name": "تهران",
            "cities_count": 8,
            "selected_cities_count": 2,
            "selected_in_setting_cities_count": 2,
            "disabled": false,
            "cities": [
              {
                "state_id": 1,
                "city_id": 9,
                "name": "دماوند",
                "selected": false,
                "exist_in_other_settings": true
              }
            ]
          }
        ],
        "other": [
          {
            "state_id": 1,
            "name": "تهران",
            "cities_count": 8,
            "selected_cities_count": 2,
            "selected_in_setting_cities_count": 2,
            "disabled": false,
            "cities": [
              {
                "state_id": 1,
                "city_id": 9,
                "name": "دماوند",
                "selected": false,
                "exist_in_other_settings": true
              }
            ]
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/shipments​/seller​/new-settings​/time-scope
Scopes => sbs_setting

List of SBS time-scopes needed to define setting
Parameters
Try it out
Name	Description
search[type]
string
(query)
	

Setting type. If set to nearby_shipping, includes all time scopes.

Available values : self_shipping, partner_shipping, nearby_shipping
size
integer
(query)
	

Defines the pagination size. The default is 50.
page
integer
(query)
	

Defines the page number. The default is 1.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSSettingTimeScopeListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1,
        "period": 4,
        "start": 9,
        "end": 17,
        "title": "یک بازه‌ی دوازده ساعته",
        "slots": [
          {
            "id": 12,
            "starts_at": 9,
            "ends_at": 21,
            "active": true,
            "capacity": 12
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/shipments​/seller​/new-settings​/deactivate-cities
Scopes => sbs_setting

Deactivate given city ids in other settings
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "city_ids": [
    1,
    2,
    3
  ],
  "nature_id": 1
}

Responses
Code	Description	Links
200	

SBSSettingDeactivateCityInOtherSettingsForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "city_ids": [
      "این قسمت نباید خالی باشد"
    ],
    "nature_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
SBS Orders (17)
GET
​/open-api​/v1​/ship-by-seller-orders
Scopes => sbs_orders

Returns list of seller's SBS orders.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id, order_date, promise_date, order_id, shipment_id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[status]
string
(query)
	

Filters the orders list based on shipment status.

Available values : pending, processed, processing, edited, rejected, awaited_drop_off, delayed_drop_off
search[search_term]
string
(query)
	

Filters the orders list based on the search_term includes in their DKP, DKPC, Order ID, Shipment ID or Title.
search[shipping_provider]
string
(query)
	

Filters the orders based on shipping method.

Available values : seller, seller_post
search[serviceProvider]
string
(query)
	

Filters by who carries the shipment. seller: self-shipping sent with the seller courier (processed, no shipping service, no live Miare trip); miare: self-shipping sent with Miare (live Miare trip); digiexpress, postex, drop_off: shipping services; fbm_drop_off: FBM shipments the seller hands to a hub.

Available values : seller, miare, digiexpress, postex, drop_off, fbm_drop_off
search[send_type]
string
(query)
	

Filters by sending type. standard: post shipments in every size (small, medium, heavy), hub drop-off included; fast: self-shipping; fbm: all FBM shipments.

Available values : standard, fast, fbm
search[past]
boolean
(query)
	

Returns the past orders.

Available values : true, false
search[future]
string
(query)
	

Filters the orders from tomorrow till the given DateTime.
search[time_scope_id]
integer
(query)
	

Filters the orders based on given time scope ID which is retrievable from the meta data of this API.
search[category_ids]
string
(query)
	

Filters the orders based on given category ID which is retrievable from the meta data of this API. List of categories should be sent in comma seperated format.
search[is_b2b]
boolean
(query)
	

Returns the orders created on b2b channels.

Available values : true, false
search[critical_only]
boolean
(query)
	

Filters to show only critical orders (commitment date has passed).

Available values : true, false
search[min_shipment_id]
integer
(query)
	

Filters to show only shipments with ID greater than or equal to this value. Useful for pagination without offset limits.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "order_date",
        "promise_date",
        "order_id",
        "shipment_id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "rowIndex": 1,
        "orderId": 1,
        "shipmentId": 1,
        "orderDate": "1403/11/07",
        "postPromiseDate": "1403/11/07",
        "digiexpress_allowed_date": "2025-03-02T00:00:00.000000+03:30",
        "digiexpressPromiseDate": "2025-03-02T00:00:00.000000+03:30",
        "deliveryDate": "1403/11/07",
        "promiseDate": "1403/11/07",
        "address": {
          "state": "فارس",
          "city": "شیراز",
          "district": "ارم"
        },
        "shippingProvider": "seller",
        "trackingCode": "11234",
        "trackingCodeStatus": "new",
        "postOrDigiexpressStatus": "new",
        "shippingNature": {
          "title": 1,
          "text": "کوچک",
          "type": "small"
        },
        "itemCount": 1,
        "shippingCost": 650000,
        "status": {
          "text": "edited",
          "text_fa": "سفارش ویرایش شده",
          "level": "warning edited"
        },
        "edited": false,
        "isCancelled": false,
        "hasFailedDeliveryBefore": false,
        "nextStatus": "processing",
        "variants": [
          {
            "image_url": "https://dkstatics-public.digikala.com/digikala-products/123",
            "title": "تیشرت مردانه",
            "theme": "black",
            "size": "small",
            "productId": "123",
            "productUrl": "https://www.digikala.com/product/dkp-123/",
            "variantId": 456,
            "sellerCode": 1,
            "leadTime": 5,
            "shippingNature": {
              "title": 1,
              "text": "کوچک",
              "type": "small"
            },
            "count": 1,
            "price": 1200000,
            "orderItemId": 654124,
            "cancellation_id": 1,
            "cancellation_reason": "A-7 قطع همکاری با فروشنده",
            "cancellation_status": false,
            "cancellation_reasons_option": [
              {
                "text": "A-7 قطع همکاری با فروشنده",
                "value": 1
              }
            ]
          }
        ],
        "isDelayed": false,
        "isOrderLocked": false,
        "itemRejectionOptions": [
          {
            "text": "A-7 قطع همکاری با فروشنده",
            "value": 1
          }
        ],
        "shipmentRejectionOptions": [
          {
            "text": "A-7 قطع همکاری با فروشنده",
            "value": 1
          }
        ],
        "isFailedDeliveryAvailable": false,
        "isFailedDeliveryButtonActive": false,
        "failedShipmentOptions": [
          {
            "text": "عدم حضور مشتری.",
            "value": 1
          }
        ],
        "isCancelling": false,
        "verificationCode": "123234",
        "editReasons": "edit-time-scope",
        "digiexpress_ability": false,
        "digiexpressData": {},
        "business_type": "b2c",
        "isDigiExpress": false,
        "customer_name": "علی علیایی",
        "customer_address": "تهران، تهران، ونک، خدامی",
        "customer_postal_code": "111111111",
        "customer_phone_number": "09121212121",
        "isDigiexpressShippingServiceActive": false,
        "isPostexShippingServiceActive": false,
        "isFBMShippingServiceActive": false,
        "showParcelData": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/statistics
Scopes => sbs_orders

Returns statistic data about the orders.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrderStatisticsObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "shipments_per_day": {
      "YYYY-MM-DD": 25
    },
    "latest_shipment_diff": 3
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/{shipment_id}
Scopes => sbs_orders

Returns the details of given order shipment ID.
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "rowIndex": 1,
    "orderId": 1,
    "shipmentId": 1,
    "orderDate": "1403/11/07",
    "postPromiseDate": "1403/11/07",
    "digiexpress_allowed_date": "2025-03-02T00:00:00.000000+03:30",
    "digiexpressPromiseDate": "2025-03-02T00:00:00.000000+03:30",
    "deliveryDate": "1403/11/07",
    "promiseDate": "1403/11/07",
    "address": {
      "state": "فارس",
      "city": "شیراز",
      "district": "ارم"
    },
    "shippingProvider": "seller",
    "trackingCode": "11234",
    "trackingCodeStatus": "new",
    "postOrDigiexpressStatus": "new",
    "shippingNature": {
      "title": 1,
      "text": "کوچک",
      "type": "small"
    },
    "itemCount": 1,
    "shippingCost": 650000,
    "status": {
      "text": "edited",
      "text_fa": "سفارش ویرایش شده",
      "level": "warning edited"
    },
    "edited": false,
    "isCancelled": false,
    "hasFailedDeliveryBefore": false,
    "nextStatus": "processing",
    "variants": [
      {
        "image_url": "https://dkstatics-public.digikala.com/digikala-products/123",
        "title": "تیشرت مردانه",
        "theme": "black",
        "size": "small",
        "productId": "123",
        "productUrl": "https://www.digikala.com/product/dkp-123/",
        "variantId": 456,
        "sellerCode": 1,
        "leadTime": 5,
        "shippingNature": {
          "title": 1,
          "text": "کوچک",
          "type": "small"
        },
        "count": 1,
        "price": 1200000,
        "orderItemId": 654124,
        "cancellation_id": 1,
        "cancellation_reason": "A-7 قطع همکاری با فروشنده",
        "cancellation_status": false,
        "cancellation_reasons_option": [
          {
            "text": "A-7 قطع همکاری با فروشنده",
            "value": 1
          }
        ]
      }
    ],
    "isDelayed": false,
    "isOrderLocked": false,
    "itemRejectionOptions": [
      {
        "text": "A-7 قطع همکاری با فروشنده",
        "value": 1
      }
    ],
    "shipmentRejectionOptions": [
      {
        "text": "A-7 قطع همکاری با فروشنده",
        "value": 1
      }
    ],
    "isFailedDeliveryAvailable": false,
    "isFailedDeliveryButtonActive": false,
    "failedShipmentOptions": [
      {
        "text": "عدم حضور مشتری.",
        "value": 1
      }
    ],
    "isCancelling": false,
    "verificationCode": "123234",
    "editReasons": "edit-time-scope",
    "digiexpress_ability": false,
    "digiexpressData": {},
    "business_type": "b2c",
    "isDigiExpress": false,
    "customer_name": "علی علیایی",
    "customer_address": "تهران، تهران، ونک، خدامی",
    "customer_postal_code": "111111111",
    "customer_phone_number": "09121212121",
    "isDigiexpressShippingServiceActive": false,
    "isPostexShippingServiceActive": false,
    "isFBMShippingServiceActive": false,
    "showParcelData": false
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/customer​/{shipment_id}
Scopes => sbs_orders

Returns the customer information.
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersCustomerDataObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "name": "علی علیایی",
    "state": "فارس",
    "city": "شیراز",
    "address": "خیابان ارم، کوچه ۱۲، پلاک ۱",
    "postalCode": "1111111111",
    "phoneNumber": "09121111111",
    "nationalCode": "0012345678",
    "shippingCost": 650000
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/post-data​/{shipment_id}
Scopes => sbs_orders

Returns the post information.
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersPostDataObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "address": {
      "state": "فارس",
      "city": "شیراز"
    },
    "weight": 3
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/time-scopes​/{shipment_id}
Scopes => sbs_orders

Returns list of time scopes
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersTimeScopesObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "value": 1,
    "text": "۱۵ - ۹"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/failed-delivery​/time-scopes​/{shipment_id}
Scopes => sbs_orders

Returns the list of available time scopes for failed delivery shipments.
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersFailedDeliveryTimeScopesObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "timescopes": [
      {
        "id": 1,
        "text": "۱۵ - ۹"
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/cancel-item
Scopes => sbs_orders

Cancels the given order.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "item_id": 1,
  "reason_id": 1,
  "count": 1
}

Responses
Code	Description	Links
200	

SBSOrdersCancelItemForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "item_id": [
      "این قسمت نباید خالی باشد"
    ],
    "reason_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/cancel-shipment
Scopes => sbs_orders

Cancels the given shipment.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "reason_id": 1
}

Responses
Code	Description	Links
200	

SBSOrdersCancelShipmentForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "reason_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/tracking-code
Scopes => sbs_orders

Adds/Updates post tracking codes to the order shipment.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "tracking_codes": {
    "id": 1,
    "tracking_code": "123"
  },
  "infra_type": "post",
  "service_name": "chapar"
}

Responses
Code	Description	Links
200	

SBSOrdersEditPostTrackingCodeForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "tracking_codes": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/ship-by-seller-orders​/update-status
Scopes => sbs_orders

Updates order shipment status to the given new status.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "new_status": "processing",
  "verification_code": 123
}

Responses
Code	Description	Links
200	

SBSOrdersUpdateStatusForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "new_status": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/full-delivered
Scopes => sbs_orders

Marks a shipment as fully delivered. Validates that the shipment was added by the provided client_id.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "tracking_codes": [
    "1234567890"
  ]
}

Responses
Code	Description	Links
200	

SBSOrdersFullDeliveredForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "tracking_codes": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/ship-by-seller-orders​/update-edited
Scopes => sbs_orders

Updates edited order status.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1
}

Responses
Code	Description	Links
200	

SBSOrdersUpdateEditedForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/failed-delivery
Scopes => sbs_orders

Sets the failed delivery reason.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "reason_id": 1,
  "capacity_id": 1
}

Responses
Code	Description	Links
200	

SBSOrdersFailedDeliveryForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "reason_id": [
      "این قسمت نباید خالی باشد"
    ],
    "capacity_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/ship-by-seller-orders​/change-time-scope
Scopes => sbs_orders

Updates the delivery time scope to the new one.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_id": 1,
  "capacity_id": 1
}

Responses
Code	Description	Links
200	

SBSOrdersChangeTimeScopeForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_id": [
      "این قسمت نباید خالی باشد"
    ],
    "capacity_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/ship-by-seller-orders​/post-order​/{shipment_id}
Scopes => sbs_orders

Returns the list of post tracking codes.
Parameters
Try it out
Name	Description
shipment_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSOrdersPostOrderDataObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1,
    "title": "123"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "shipment_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/ship-by-seller-orders​/batch-update-status
Scopes => sbs_orders

Order shipments batch update
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_ids": [
    223441715
  ],
  "new_status": "processing",
  "select_all": false
}

Responses
Code	Description	Links
200	

SBSOrdersBatchUpdateStatusForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "new_status": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
SBS nearby stores (2)
GET
​/open-api​/v1​/near-by-stores
Scopes => sbs_orders

Get all SBS nearby stores orders
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id, order_date, promise_date, order_id, nearby_stores_sla_start_at

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[status]
string
(query)
	

Filters the orders list based on shipment status.

Available values : pending, processing, processed
search[search_term]
string
(query)
	

Filters the orders list based on the search_term includes in their DKP, DKPC, Order ID, Shipment ID or Title.
search[category_ids]
string
(query)
	

Filters the orders based on given category ID which is retrievable from the meta data of this API. List of categories should be sent in comma seperated format.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SBSNearByStoresListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "order_date",
        "promise_date",
        "order_id",
        "nearby_stores_sla_start_at"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "rowIndex": 1,
        "orderId": 1,
        "shipmentId": 1,
        "orderDate": "1403/11/07",
        "postPromiseDate": "1403/11/07",
        "digiexpress_allowed_date": "2025-03-02T00:00:00.000000+03:30",
        "digiexpressPromiseDate": "2025-03-02T00:00:00.000000+03:30",
        "deliveryDate": "1403/11/07",
        "promiseDate": "1403/11/07",
        "address": {
          "state": "فارس",
          "city": "شیراز",
          "district": "ارم"
        },
        "shippingProvider": "seller",
        "trackingCode": "11234",
        "trackingCodeStatus": "new",
        "postOrDigiexpressStatus": "new",
        "shippingNature": {
          "title": 1,
          "text": "کوچک",
          "type": "small"
        },
        "itemCount": 1,
        "shippingCost": 650000,
        "status": {
          "text": "edited",
          "text_fa": "سفارش ویرایش شده",
          "level": "warning edited"
        },
        "edited": false,
        "isCancelled": false,
        "hasFailedDeliveryBefore": false,
        "nextStatus": "processing",
        "variants": [
          {
            "image_url": "https://dkstatics-public.digikala.com/digikala-products/123",
            "title": "تیشرت مردانه",
            "theme": "black",
            "size": "small",
            "productId": "123",
            "productUrl": "https://www.digikala.com/product/dkp-123/",
            "variantId": 456,
            "sellerCode": 1,
            "leadTime": 5,
            "shippingNature": {
              "title": 1,
              "text": "کوچک",
              "type": "small"
            },
            "count": 1,
            "price": 1200000,
            "orderItemId": 654124,
            "cancellation_id": 1,
            "cancellation_reason": "A-7 قطع همکاری با فروشنده",
            "cancellation_status": false,
            "cancellation_reasons_option": [
              {
                "text": "A-7 قطع همکاری با فروشنده",
                "value": 1
              }
            ]
          }
        ],
        "isDelayed": false,
        "isOrderLocked": false,
        "itemRejectionOptions": [
          {
            "text": "A-7 قطع همکاری با فروشنده",
            "value": 1
          }
        ],
        "shipmentRejectionOptions": [
          {
            "text": "A-7 قطع همکاری با فروشنده",
            "value": 1
          }
        ],
        "isFailedDeliveryAvailable": false,
        "isFailedDeliveryButtonActive": false,
        "failedShipmentOptions": [
          {
            "text": "عدم حضور مشتری.",
            "value": 1
          }
        ],
        "isCancelling": false,
        "verificationCode": "123234",
        "editReasons": "edit-time-scope",
        "digiexpress_ability": false,
        "digiexpressData": {},
        "business_type": "b2c",
        "isDigiExpress": false,
        "customer_name": "علی علیایی",
        "customer_address": "تهران، تهران، ونک، خدامی",
        "customer_postal_code": "111111111",
        "customer_phone_number": "09121212121",
        "isDigiexpressShippingServiceActive": false,
        "isPostexShippingServiceActive": false,
        "isFBMShippingServiceActive": false,
        "showParcelData": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/near-by-stores​/customer-not-respond
Scopes => sbs_orders

Marks nearby-store shipments as customer_not_respond after SLA start + 24h, when no ship-by-seller failed-delivery row exists yet.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "order_shipment_ids": {},
  "reason_id": 1
}

Responses
Code	Description	Links
200	

NearByStoresBulkCustomerNotRespondForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "order_shipment_ids": [
      "این قسمت نباید خالی باشد"
    ],
    "reason_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Lightening (9)
GET
​/open-api​/v1​/lightening-deal​/products
Scopes => lightening_deal

List of seller products to choose from for lightening deal.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
enum
(query)
	

Define list sort column. can be bestSeller | mostViewed | mostStock | userDemanded | latest | ai

Default value : latest
order
string
(query)
	

Define list sort order.

Default value : desc
search[q]
string
(query)
	

The search Keyword to lookup in product titles, can be a dkp or dkpc.

Default value :
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealProductListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1234,
        "title_fa": "کتاب چگونه",
        "title_en": "book",
        "image": "https://dkstatics-public.digikala.com/digikala-products/420ae4cfc7cb8fcea299e90d2b7d_1689494808.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60",
        "price": 10000,
        "views": 123,
        "orders": 123,
        "seller_id": 1234,
        "disabled": true,
        "validationMessages": [
          "عدم موجودی"
        ],
        "stock": 4
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/products​/{product_id}
Scopes => lightening_deal

Get a list of product variants for a seller based on the product ID.
Parameters
Try it out
Name	Description
product_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 2000
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealProductVariantListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "product_id": 12345,
        "category_id": 123,
        "title": "کتاب جادوگر",
        "image": "https://dkstatics-public.digikala.com/digikala-products/3abc96f0a4f6e9d6027b97e72d_1688993101.jpg?x-oss-process=image/resize,m_lfit,h_240,w_240/quality,q_80",
        "stock": 4,
        "has_stock": true,
        "max_send_to_warehouse": 2,
        "min_discount": 20,
        "max_allowable_price": 1230000,
        "price": 123000,
        "views": 123,
        "orders": 123
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/promotions
Scopes => lightening_deal

Get a list of lightening deal promotions per date.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealPromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {}
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/promotions​/{productId}
Scopes => lightening_deal

Get a list of lightening deal promotions that are available for specified product ID.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealValidatedPromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "startDate": "1403/06/11",
        "day": 11,
        "month": "شهریور",
        "year": 1403,
        "weekdayName": "یکشنبه",
        "dayOfWeek": 1,
        "message": "",
        "timeslots": {
          "123456789": {
            "startAt": "2024-09-01 00:00:00",
            "endAt": "2024-09-01 08:00:00",
            "startAtTime": "00:00",
            "endAtTime": "08:00",
            "promotionId": 123456789,
            "bidCount": 76,
            "maxBid": 20000000,
            "minBidToWin": 10000000,
            "minAllowableBid": 10000000,
            "maxAllowableBid": 30000000
          }
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/lightening-deal​/bids
Scopes => lightening_deal

Create new lightening deal bid.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "bidsData": {
    "productVariantId": 1,
    "productId": 1,
    "source": "markito_manual",
    "promotions": {
      "promotionId": 1,
      "promotionPrice": 4500000,
      "numberOfVariantsInPromotion": 50,
      "minBid": 7000000,
      "autoRaise": 15,
      "upperBound": 7000000,
      "paymentMethod": "wallet"
    }
  }
}

Responses
Code	Description	Links
200	

LighteningDealCreateBidForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "chargeWallet": true,
    "totalBIdsPrice": 10000000,
    "productVariantsCount": 1,
    "promotionsCount": 1,
    "totalPrice": 10000000,
    "totalPriceWallet": 10000000,
    "totalPriceCredit": 0,
    "variantQuantity": 1,
    "promotionsQuantity": 1
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "bidsData": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/bids
Scopes => lightening_deal

List of seller Lightening deal bids.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sorting.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : desc
search[status]
string
(query)
	

filter results by status.

Available values : all, pending, payment, productSupply, approvedWinner, live, ended, lost

Default value :
search[startDate]
integer
(query)
	

Timestamp in milliseconds

Default value :
search[endDate]
integer
(query)
	

Timestamp in milliseconds

Default value :
search[q]
string
(query)
	

Product or product variant ID to use when querying

Default value :
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealBidsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "promotionId": 12345,
        "bidId": 123456,
        "dkp": 1234,
        "productId": 1234,
        "date": {
          "day": 11,
          "month": "شهریور",
          "weekdayName": "یکشنبه",
          "start": "2024-09-01 00:00:00",
          "end": "2024-09-01 08:00:00",
          "startHour": "00:00",
          "endHour": "08:00"
        },
        "remainingTime": {
          "days": 0,
          "hours": 20,
          "minutes": 1
        },
        "bidCount": 77,
        "minBid": 1000000,
        "maxBid": 10000000,
        "autoRaise": 3,
        "finalBidAmount": 0,
        "status": "pending",
        "paymentMethod": "wallet",
        "isPaymentMethodEditable": true,
        "availablePaymentMethods": [
          "wallet"
        ],
        "productVariants": [
          {
            "title": "کتاب جادوگر",
            "productVariantId": 12345,
            "dkpc": 12345,
            "price": 2300000,
            "promotionPrice": 1727000,
            "offPercent": 24,
            "numberOfVariantsInPromotion": 4,
            "remainingNumberOfVariantsInPromotion": 4,
            "numberOfVariantsSoldInPromotion": 0,
            "revenue": 0,
            "image": "https://dkstatics-public.digikala.com/digikala-products/3bc6e9d6027b97e72d_1688993101.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60"
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/bidsSummary
Scopes => lightening_deal

show lightening deal statistics per their status
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

LighteningDealBidsSummaryObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "pending": 1,
    "payment": 0,
    "productSupply": 0,
    "approvedWinner": 0,
    "live": 0,
    "ended": 0,
    "lost": 0
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/lightening-deal​/check-duplicate-dkp-in-promotion​/{promotionId}​/{productId}
Scopes => lightening_deal

Check if seller has same product in same promotion or not to prevent duplicate product bids
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

LighteningDealDuplicateBidVariantObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "کالای انتخابی در این بازه مزایده  شگفت انگیز فعال دارد و امکان ساخت مزایده جدید وجود ندارد"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/lightening-deal​/bids​/{bidId}​/payment-method
Scopes => lightening_deal

change lightening deal bid payment method to wallet/credit.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

LighteningDealChangePaymentMethodForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "paymentMethod": [
      "این قسمت نباید خالی باشد"
    ],
    "bidId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
BuyBox (2)
GET
​/open-api​/v1​/pricing​/buybox​/price-suggestion​/winning-price
Scopes => variant

suggests a reasonable price for winning the buybox of product
Parameters
Try it out
Name	Description
product_variant_id *
integer
(query)
	

unique id of product variant
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

BuyBoxWinningPriceSuggestionView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "suggested_price": 2561000
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/buybox​/price-suggestion​/nth-rank-winning-price
Scopes => variant

suggests a reasonable price for winning n-th rank in buybox of product
Parameters
Try it out
Name	Description
product_variant_id *
integer
(query)
	

unique id of product variant
target_rank *
integer
(query)
	

the expected rank number for your variant
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

BuyBoxNthRankWinningPriceSuggestionView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "suggested_price": 2561000
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Smart Discount (15)
GET
​/open-api​/v1​/pricing​/smart-discount​/variants​/eligible
Scopes => promotion

Get list of Eligible product variants to set periodic prices (smart discount) ont them.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : latest, price_low, price_high, earliest

Default value : latest
order
string
(query)
	

Define list sort order.

Default value : asc
search[query]
string
(query)
	

Search keyword. Could be product id, product variant id or their titles.
search[onlyBuyBoxWinner]
bool
(query)
	

filter to show only variants which are buy box winners of their products.

Default value : false
search[isOutlet]
bool
(query)
	

Filter only outlet variants.

Default value : false
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PeriodicPriceEligibleVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "latest",
      "sort_order": "asc",
      "sort_columns": [
        "latest",
        "price_low",
        "price_high",
        "earliest"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "promotion_variant_id": 123456,
        "parent_id": 789012,
        "status": "approved",
        "rejection_reason": "Insufficient discount percentage",
        "image_link": "https://example.com/images/products/123456.jpg",
        "product_id": 789012,
        "category_id": 34,
        "product_link": "https://example.com/products/789012",
        "product_variant_id": 345678,
        "product_variant_title": "Premium Wireless Headphones - Black",
        "buy_box_winner_price": 199900,
        "min_price_in_promotion": 179900,
        "min_sku_selling_price": 169900,
        "discount_percent": 15,
        "discount_precision": 0,
        "rrp_price": 219900,
        "selling_price": 189900,
        "cash_selling_price": 1000000,
        "cash_rrp_price": 1200000,
        "credit_selling_price": 1000000,
        "credit_rrp_price": 1200000,
        "credit_increase_percentage": 1000000,
        "min_incredible_discount": 20,
        "digikala_stock": 50,
        "seller_stock": 30,
        "promotion_price": 179900,
        "commission": 5000,
        "selling_stock": 80,
        "promotion_limit": 100,
        "order_limit": 2,
        "max_allowable_price": 219900,
        "min_category_discount": 10,
        "start_at": "2024-06-01T00:00:00Z",
        "end_at": "2024-06-30T23:59:59Z",
        "meta_data": {
          "total_joined": 15,
          "remaining_slots": 10
        },
        "last_week_product_view_count": 1200,
        "last_week_sales_count": 85,
        "is_highly_demanded_product": true,
        "already_exists_in_incredible_promotion": false,
        "already_exist_in_same_promotion": false,
        "is_buy_box_winner": true,
        "has_commission_discount": false,
        "is_auto_joined": false,
        "can_join_to_mega_promotion": false,
        "product_type": "physical",
        "incentive": false,
        "is_outlet": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/smart-discount​/variants​/{active_status}
Scopes => promotion

smart discount page. getting variants with periodic prices. active status should be one of (active , inactive).
Parameters
Try it out
Name	Description
active_status *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[query]
string
(query)
	

Filter search by product_id, product_variant_id, or product title.
search[status]
array
(query)
	

filter based on status. first enum list for active tab, second enum list for inactive

Available values : List [ "approved", "active" ], List [ "rejected", "ended" ]
search[startedAt]
string
(query)
	

filter start time from...
search[endAt]
string
(query)
	

filter end time before...
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PeriodicPriceVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "promotion_variant_id": 123456789,
        "variant_id": 98765432,
        "variant_price_id": 1122334455,
        "product_id": 567890,
        "product_link": "https://www.digikala.com/product/dkp-567890/",
        "selling_price": 1000000,
        "rrp_price": 1200000,
        "cash_selling_price": 1000000,
        "cash_rrp_price": 1200000,
        "cash_discount": 1000000,
        "credit_selling_price": 1000000,
        "credit_rrp_price": 1200000,
        "credit_discount": 1000000,
        "credit_increase_percentage": 1000000,
        "selling_stock": 10,
        "promotion_price": 900000,
        "limit": 5,
        "order_limit": 2,
        "discount": 15,
        "discount_precision": 0,
        "min_discount": 5,
        "max_allowable_price": 950000,
        "title": "Medium-sized wristwatch model 1634 BK | Original warranty and official service",
        "platform": "digikala",
        "promotion_status": "active",
        "started_at": "2025-04-29T00:00:00Z",
        "end_at": "2025-05-28T23:59:59Z",
        "image_link": "https://cdn.example.com/images/products/1634bk.jpg",
        "auto_joined": {
          "normal": false,
          "mega_promotion": false
        },
        "can_join_to_mega_promotion": false,
        "incentive": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/smart-discount​/variants​/batch
Scopes => promotion

Batch create periodic price variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "data": [
    {
      "variantId": 123456,
      "promotionPrice": 100000,
      "limit": 1,
      "orderLimit": 1,
      "startAt": "2024-06-01T00:00:00Z",
      "endAt": "2024-06-30T23:59:59Z"
    }
  ]
}

Responses
Code	Description	Links
200	

CreatePeriodicPriceBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123456,
    "success": true,
    "message": "Price must be ended with two zeros.",
    "insight": {
      "code": "400",
      "meta": {
        "suggested_rrp": 1250000,
        "selling_price": 990000,
        "suggested_discount_percent": 21,
        "is_suggested_rrp_applicable": true
      }
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "data": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/pricing​/smart-discount​/variants​/batch
Scopes => promotion

Batch edit periodic price variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "promotionVariantIds": [
    123,
    456
  ],
  "discount": 10,
  "limit": 3,
  "orderLimit": 2,
  "startedAt": "2026-07-21T18:14:46.224256+03:30",
  "endAt": "2026-07-21T18:14:46.224256+03:30"
}

Responses
Code	Description	Links
200	

EditPeriodicPriceBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123456,
    "success": true,
    "message": "invalid price limit",
    "insight": {
      "code": "400",
      "meta": {
        "suggested_rrp": 1250000,
        "selling_price": 990000,
        "suggested_discount_percent": 21,
        "is_suggested_rrp_applicable": true
      }
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotionVariantIds": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/smart-discount​/variants
Scopes => promotion

Atomically create periodic price variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "data": [
    {
      "variantId": 123456,
      "promotionPrice": 100000,
      "limit": 3,
      "orderLimit": 2,
      "startedAt": "2024-06-01T00:00:00Z",
      "endAt": "2024-06-30T23:59:59Z"
    }
  ]
}

Responses
Code	Description	Links
200	

AtomicPeriodicPriceCreationForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123456,
    "success": true,
    "message": "order limit should be less than 30.",
    "insight": {
      "code": "400",
      "meta": {
        "suggested_rrp": 1250000,
        "selling_price": 990000,
        "suggested_discount_percent": 21,
        "is_suggested_rrp_applicable": true
      }
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "data": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/pricing​/smart-discount​/variants
Scopes => promotion

Edit a single periodic price variant.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "promotionVariantId": 123,
  "promotionPrice": 10000,
  "discount": 10,
  "limit": 3,
  "orderLimit": 2,
  "startedAt": "2026-07-21T18:14:46.224256+03:30",
  "endAt": "2026-07-21T18:14:46.224256+03:30"
}

Responses
Code	Description	Links
200	

EditPeriodicPriceSingleForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123456,
    "success": true,
    "message": "price must be positive and greater than 1000",
    "insight": {
      "code": "400",
      "meta": {
        "suggested_rrp": 1250000,
        "selling_price": 990000,
        "suggested_discount_percent": 21,
        "is_suggested_rrp_applicable": true
      }
    }
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotionVariantId": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/pricing​/smart-discount​/variants
Scopes => promotion

Batch delete periodic price variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variant_ids": [
    123456,
    123457
  ]
}

Responses
Code	Description	Links
200	

DeletePeriodicPriceBatchForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 123456,
    "success": true,
    "message": "you are not allowed to delete this variant price."
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "ids": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/pricing​/smart-discount​/variants​/all
Scopes => promotion

Batch delete periodic price variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variant_ids": [
    123456,
    123457
  ]
}

Responses
Code	Description	Links
200	

BatchDeletePeriodicPriceVariantsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Periodic price variant deleted successfully."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/smart-discount​/variants​/eligible​/excel
Scopes => promotion

By this route, you can get an excel list of all your eligible variants to join an smart discount promotion.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SmartDiscountEligibleVariantsExcelExportForm
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/smart-discount​/variants​/excel​/sample
Scopes => promotion

Get a sample Excel file for joining your variants to a smart discount.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SampleJoinSmartDiscountExcelExportView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/smart-discount​/variants​/excel​/async-export
Scopes => promotion

Get export of periodic price variants via email. 500 rows at most!
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PeriodicPriceVariantsExportAsyncObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "success": true
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/smart-discount​/variants​/excel
Scopes => promotion

By this route, you can use excel to join periodic-prices promotions.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

JoinPeriodicPricesExcelImportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Your file has been accepted for processing",
    "importRequestIds": 12345
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/smart-discount​/variants​/excel​/delete-all-async
Scopes => promotion

Batch delete periodic prices promotion variants using excel.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

PeriodicPriceVariantsBatchDeleteExcelImportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Your file has been accepted for processing.",
    "import_request_id": 12345
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "file_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/smart-discount​/auto-joined​/{campaign_name}
Scopes => promotion

get campaigns that seller's specific variant was auto joined to them
Parameters
Try it out
Name	Description
campaign_name *
(path)
	
promotionVariantId *
int
(query)
	

The promotion variant that seller wants to see its joined campaign details
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PeriodicPriceAutoJoinedCampaignsDetailObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "promotion_variant_id": 123456,
    "selling_price": 199900,
    "promotion_price": 179900,
    "promotions": [
      {
        "promotion_id": 789012,
        "title": "Summer Sale 2024",
        "promotion_status": "active",
        "promotion_variant_status": "approved",
        "started_at": "2024-06-01T00:00:00Z",
        "end_at": "2024-06-30T23:59:59Z",
        "categories": [
          "electronics",
          "fashion"
        ],
        "discount_type_percent": 20,
        "discount_type_amount": null,
        "min_price": 100000,
        "max_price": 500000,
        "max_discount": 25000,
        "min_variants": 5,
        "promotion_link": "https://example.com/promotions/summer-sale",
        "has_banner": true,
        "condition": {
          "min_order_value": 100000
        }
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/eligible​/excel
Scopes => promotion

By this route, you can get an excel list of all your eligible variants to join an smart discount promotion.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

JoinPromotionEligibleVariantsExcelExportForm
	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Promotions (24)
GET
​/open-api​/v1​/pricing​/promotions
Scopes => promotion

See a list of seller's registered promotions.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : promotion_id

Default value : promotion_id
order
string
(query)
	

Define list sort order.

Default value : desc
search[nature]
string
(query)
	

Filter nature of the promotions. Accepts a comma-seperated value.
search[status]
string
(query)
	

Filter promotions by their status. Accepts a comma-seperated value.
search[searchKeyword]
string
(query)
	

Filter promotions by their title or their joined variantId.
search[startAt]
string
(query)
	

Filter promotions by start date. Should be ISO date.
search[endAt]
string
(query)
	

Filter promotions by end date. Should be ISO date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "promotion_id",
      "sort_order": "desc",
      "sort_columns": [
        "promotion_id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "title": "Mega Sale",
        "has_commission_discount": true,
        "nature": "incredible_offer",
        "categories": [
          {
            "id": 1,
            "name": "Electronics"
          }
        ],
        "start_at": "2023-08-22T18:54:44Z",
        "end_at": "2023-08-25T18:54:44Z",
        "status": "active",
        "total_views": 1000,
        "total_sales": 100,
        "auto_joined_variants_count": 5,
        "variants_stats": {
          "approved": 10,
          "draft": 5,
          "rejected": 2
        },
        "badge": {
          "icon": "star",
          "title": "Featured",
          "color": "#FF0000"
        },
        "incentive": 1000,
        "is_promotion_report_active": true,
        "is_extra": true
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/configs
Scopes => promotion

get mega promotion configs
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

MegaPromotionConfigView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "start_at": "2024-05-15 00:00:00",
    "end_at": "2024-05-30 23:59:59",
    "title": "Summer Mega Sale 2024",
    "dashboard_landing_banner_section": {
      "banner_id": 123,
      "image_url": "https://example.com/banners/dashboard.jpg",
      "link": "https://example.com/promotions/summer-sale"
    },
    "smart_discount_landing_banner_section": {
      "banner_id": 456,
      "image_url": "https://example.com/banners/smart-discount.jpg",
      "link": "https://example.com/promotions/smart-discounts"
    },
    "landing_svg_image_url": "https://example.com/images/promotions/summer-sale.svg",
    "variants_count": 1500,
    "sellers_count": 250,
    "extra_data": {
      "featured_products": [
        123,
        456,
        789
      ]
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/recommended
Scopes => promotion

See a list of seller's recommended promotions.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

RecommendedPromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "eligible_promotions_count": 5,
        "eligible_product_variants_count": 120,
        "recommended_promotions": [
          {
            "id": 123456,
            "title": "Summer Sale 2024",
            "start_at": "2024-06-01T00:00:00+00:00",
            "end_at": "2024-06-30T23:59:59+00:00",
            "badge_icon": "https://example.com/badges/summer-sale.svg",
            "badge_title": "Hot Deal",
            "badge_color": "#FF5733",
            "cmp_link": "https://example.com/promotions/summer-sale"
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/eligible
Scopes => promotion

See a list of eligible promotions to join.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : id, start_at, end_at, join_deadline

Default value : join_deadline
order
string
(query)
	

Define list sort order.

Default value : asc
search[nature]
string
(query)
	

Filter nature of the promotions. Accepts a comma-seprated value.
search[label_ids]
string
(query)
	

Filter label of the promotions. Accepts a comma-seperated value.
search[excludeJoined]
bool
(query)
	

Exclude promotions that seller already have variants joined.

Default value : 0
search[title]
string
(query)
	

Filter promotions by their title.
search[startAt]
string
(query)
	

Filter promotions by start date. Should be ISO date.
search[endAt]
string
(query)
	

Filter promotions by end date. Should be ISO date.
search[lastSeconds]
bool
(query)
	

Filter promotions by last seconds.

Default value : 0
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

EligiblePromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "join_deadline",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "start_at",
        "end_at",
        "join_deadline"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "badge_color": null,
        "badge_icon": null,
        "badge_title": null,
        "categories": [
          1,
          2
        ],
        "cmp_link": "https://digikala.com/promotion-page/cmp_123456/",
        "conditions": "Minimum discount percentage 1%",
        "end_at": "2025-01-01T23:59:00.000000+00:00",
        "has_already_joined": false,
        "has_commission_discount": false,
        "id": 123456789,
        "incentive": false,
        "join_deadline": "2024-12-31T23:59:00.000000+00:00",
        "nature": "incredible_offer",
        "number_of_potential_variants": 100,
        "participants": 50,
        "platforms": [
          "digikala",
          "digistyle"
        ],
        "promotion_min_discount": 5,
        "start_at": "2024-12-01T00:00:00.000000+00:00",
        "supply_categories": [
          1,
          2,
          5
        ],
        "title": "Special Summer Sale 2024"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/promotions​/eligible​/min-discounts
Scopes => promotion

Get a list of minimum discounts per leaf category for eligible promotions of seller's variants.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "variant_ids": [
    240559525,
    240559526,
    240559527
  ],
  "promotion_nature": "mega_promotion"
}

Responses
Code	Description	Links
200	

EligiblePromotionsMinDiscountsPerLeafCategoryForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "category_id": 1234,
    "min_discount": 10.5
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_ids": [
      "این قسمت نباید خالی باشد"
    ],
    "promotion_nature": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/unjoined
Scopes => promotion

See a list of eligible promotions that seller have not already joined.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[nature]
string
(query)
	

Filter nature of the promotions. Accepts a comma-seprated value.

Default value : mega_promotion
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

UnjoinedPromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "title": "Summer Mega Sale 2024",
        "has_commission_discount": false,
        "badge_title": "Special Offer",
        "badge_color": "#FF5733",
        "badge_icon": "https://example.com/badges/special-offer.svg",
        "cmp_link": "https://example.com/promotions/summer-sale",
        "conditions": "Minimum 5% discount required",
        "nature": "incredible_offer",
        "categories": [
          "electronics",
          "fashion"
        ],
        "supply_categories": [
          "apparel",
          "accessories"
        ],
        "platforms": [
          "mobile",
          "web"
        ],
        "start_at": "2024-06-01T00:00:00+00:00",
        "end_at": "2024-06-30T23:59:59+00:00",
        "join_deadline": "2024-05-25T23:59:59+00:00",
        "number_of_potential_variants": 1500,
        "participants": 250,
        "has_already_joined": false,
        "promotion_min_discount": 5,
        "incentive": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/variant-current-promotions​/{product_variant_id}
Scopes => promotion

Provides a list of current promotions for a variant
Parameters
Try it out
Name	Description
product_variant_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 200
sort
string
(query)
	

Define list sort column.

Available values : promotion_id

Default value : promotion_id
order
string
(query)
	

Define list sort order.

Default value : asc
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

VariantCurrentPromotionsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "items": {
          "promotion_id": 150332,
          "variant_status": "approved",
          "promotion_title": "PP-2025-05-28 17:10:25-2025-06-27 23:58:25",
          "promotion_type": "periodic_prices",
          "start_at": {
            "date": "2025-02-07 00:00:00.000000",
            "timezone_type": 3,
            "timezone": "Asia/Tehran"
          },
          "end_at": {
            "date": "2025-02-07 00:00:00.000000",
            "timezone_type": 3,
            "timezone": "Asia/Tehran"
          },
          "promotion_rrp_price": 54000000,
          "promotion_selling_price": 48000000
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/variants
Scopes => promotion

See a list of seller's variants that joined to promotions.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[promotionStatus]
string
(query)
	

Filter variants by promotion status.
search[promotionVariantStatus]
string
(query)
	

Filter variants by promotion variant status.
search[query]
string
(query)
	

Filter variants by product or variant id or title.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

JoinedVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "title": "Premium Wireless Headphones - Black",
        "category_order_limit": [
          1,
          5
        ],
        "image": "https://example.com/images/products/123456.jpg",
        "product_id": 789012,
        "product_link": "https://example.com/products/789012",
        "selling_price": 199900,
        "promotion_price": 179900,
        "buy_box_winner_price": 189900,
        "min_category_discount": 10,
        "max_allowable_price": 219900,
        "discount_precision": 0,
        "promotion_variants": [
          {
            "id": 111222,
            "discount": 15,
            "status": "active",
            "promotion_price": 179900,
            "selling_price": 199900,
            "crossed_price": 219900,
            "promotion_limit": 100,
            "order_limit": 2,
            "has_commission_discount": false,
            "promotion": {
              "id": 333444,
              "title": "Summer Mega Sale",
              "status": "active",
              "tag": "flash_sale",
              "nature": "incredible_offer",
              "commission_discount": true
            }
          }
        ],
        "promotion_variants_count": 3,
        "incentive": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/variants​/{variant_id}
Scopes => promotion

See the details of a joined variant.
Parameters
Try it out
Name	Description
variant_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

JoinedVariantDetailListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "title": "Premium Wireless Headphones - Black",
        "category_order_limit": [
          1,
          10
        ],
        "image": "https://example.com/images/products/123456.jpg",
        "product_id": 789012,
        "product_link": "https://example.com/products/789012",
        "selling_price": 199900,
        "promotion_price": 179900,
        "buy_box_winner_price": 189900,
        "min_category_discount": 10,
        "max_allowable_price": 219900,
        "discount_precision": 0,
        "promotion_variants": [
          [
            {
              "id": 111222,
              "discount": 15,
              "status": "active",
              "promotion_price": 179900,
              "selling_price": 199900,
              "crossed_price": 219900,
              "promotion_limit": 100,
              "order_limit": 2,
              "has_commission_discount": false,
              "promotion": {
                "id": 333444,
                "title": "Summer Sale"
              }
            }
          ]
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/variants​/rejection-reason​/{promotion_variant_id}
Scopes => promotion

See an Incredible promotion variant rejection reason
Parameters
Try it out
Name	Description
promotion_variant_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[promotion_variant_id]
int
(query)
	

promotion variant to see
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

IncrediblePromotionVariantRejectionReasonListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "promotion_variant_id": 123456,
        "result": [
          {
            "title": "Product not eligible for promotion",
            "priority": 1
          },
          {
            "title": "Insufficient stock",
            "priority": 2
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}
Scopes => promotion

See the details of a promotion.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PromotionDetailObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 280237402,
    "title": "Special Spring Promotion",
    "cmp_link": "https://example.com/promotion-page/cmp_123456/",
    "status": "approved",
    "platform": "digikala",
    "start_at": "2025-04-28T23:00:00.000000+03:30",
    "end_at": "2025-04-30T00:00:00.000000+03:30",
    "join_deadline": "2025-04-28T22:59:00.000000+03:30",
    "is_join_active": false,
    "is_ended": false,
    "type": "public",
    "tag": "selling_and_sales",
    "nature": "incredible_offer",
    "tag_label": "Special Offer",
    "campaign_details": {},
    "conditions": "Minimum discount percentage must be 1%,Minimum 5 items required for the promotion",
    "condition_schema": {
      "promotion_id": 280237402,
      "min_discount_percent": "11",
      "max_discount_percent": "44",
      "max_price": "1000000",
      "min_price": "100",
      "min_discount_amount": ""
    },
    "filters": [
      "digikala"
    ],
    "categories": {},
    "supply_categories": {},
    "commission_discount": "",
    "is_extra": false,
    "remaining_quota": 1,
    "stats": {
      "approved": 0,
      "draft": 0,
      "rejected": 0,
      "auto_joined_variants_count": 0
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants
Scopes => promotion

See promotion variants of a promotion.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[selectedIds]
string
(query)
	

Filter by promotion_variant_id.
search[searchKeyword]
string
(query)
	

Filter by product_id or product_variant_id or product_variant title.
search[status]
string
(query)
	

Filter by promotion variant status.
search[onlyAutoJoined]
string
(query)
	

Filter Promotion variants which have parent

Default value : false
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PromotionVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123,
        "parent_id": 0,
        "image": "https://dkstatic.digikala.com/123.jpg",
        "product_id": 456,
        "product_link": "https://www.digikala.com/product/456",
        "product_variant_id": 789,
        "title": "Red T-shirt XL",
        "buy_box_winner_price": 100000,
        "min_price_in_promotion": 95000,
        "min_sku_selling_price": 90000,
        "selling_price": 105000,
        "discount": 10,
        "discount_precision": 0,
        "min_category_discount": 5,
        "promotion_price": 95000,
        "max_allowable_price": 110000,
        "commission": 8,
        "selling_stock": 50,
        "promotion_limit": 5,
        "min_promotion_limit": 12,
        "order_limit": 2,
        "status": "approved",
        "last_week_product_view_count": 1000,
        "last_week_sales_count": 100,
        "is_highly_demanded_product": true,
        "already_exists_in_incredible_promotion": false,
        "already_exist_in_same_promotion": false,
        "is_buy_box_winner": true,
        "has_commission_discount": false,
        "rrp_price": 120000,
        "is_auto_joined": false,
        "incentive": 0,
        "rejection_reason": "Out of stock",
        "cash_selling_price": 10000,
        "cash_rrp_price": 10000,
        "cash_discount": 8,
        "credit_selling_price": 10000,
        "credit_rrp_price": 10000,
        "credit_discount": 10000,
        "credit_increase_percentage": 10000,
        "category_price_configs": {
          "order_limit_minimum": 5,
          "order_limit_maximum": 10
        },
        "is_extra": false,
        "extra_offer_min_item": 10000,
        "extra_offer_min_nmv": 10000
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants
Scopes => promotion

Atomically join multiple variants to a promotion. Each variant will be processed independently. Returns the result for each variant.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "data": [
    {
      "variant_id": 1123,
      "promotion_price": 350000,
      "order_limit": 5,
      "price_limit": 10
    },
    {
      "variant_id": 1124,
      "promotion_price": 7430000,
      "order_limit": 3,
      "price_limit": 7
    }
  ]
}

Responses
Code	Description	Links
200	

AtomicJoinVariantsToPromotionForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1123,
    "success": true,
    "message": "price must be positive and greater than 1000"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "data": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants
Scopes => promotion

Batch edit variants of a promotion. Each variant will be edited with the provided values.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "data": [
    {
      "variant_id": 39707414,
      "promotion_price": 120000,
      "order_limit": 1,
      "price_limit": 1
    },
    {
      "variant_id": 39275990,
      "promotion_price": 4250000,
      "order_limit": 1,
      "price_limit": 1
    }
  ]
}

Responses
Code	Description	Links
200	

EditPromotionVariantsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 39707414,
    "success": true,
    "message": "price must be positive and greater than 1000"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "data": [
      "تغییر جدیدی برای ثبت وجود ندارد."
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants
Scopes => promotion

Batch delete promotion variants of a campaign. Each variant will be deleted and the result returned.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "ids": [
    240559525,
    240559526,
    240559527
  ]
}

Responses
Code	Description	Links
200	

DeletePromotionVariantsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 240559525,
    "success": true,
    "message": "price must be positive and greater than 1000"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "ids": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/rejected
Scopes => promotion

See rejected/draft promotion variants of a promotion.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

RejectedOrDraftPromotionVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "image_link": "https://dkstatic.digikala.com/123.jpg",
        "product_id": 12345,
        "product_title": "Sample Product",
        "last_week_product_view_count": 1000,
        "last_week_sales_count": 100,
        "variants": [
          {
            "promotion_variant_id": 123456,
            "product_id": 789012,
            "product_variant_id": 345678,
            "variant_title": "Premium Wireless Headphones - Black",
            "promotion_price": 199900
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/batch
Scopes => promotion

Batch join variants to a promotion. Each variant will be processed and the result returned.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "data": [
    {
      "variant_id": 1123,
      "promotion_price": 350000,
      "order_limit": 5,
      "price_limit": 10
    },
    {
      "variant_id": 1124,
      "promotion_price": 7430000,
      "order_limit": 3,
      "price_limit": 7
    }
  ]
}

Responses
Code	Description	Links
200	

JoinVariantsToPromotionForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 1123,
    "success": true,
    "message": "price must be positive and greater than 1000"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "data": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/batch
Scopes => promotion

Batch edit variants of a promotion. Each variant will be updated with the provided values.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "ids": [
    240559525,
    240559526,
    240559527
  ],
  "discount": 12,
  "order_limit": 1,
  "price_limit": 1
}

Responses
Code	Description	Links
200	

BatchEditPromotionVariantsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 240559525,
    "success": true,
    "message": "price must be positive and greater than 1000"
  }
}

	No links
400	

Validation error! check your inputs. Also returned when the variant has no approved photos at the level its category requires (see the category config variant_photo). Batch endpoints report it per item instead.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "ids": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_photo": [
      "string"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/eligible
Scopes => promotion

See a list of eligible variants to join.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define promotion variant's sort method.

Default value : latest
search[query]
string
(query)
	

Filter by variant_id, product_id, or title.
search[onlyBuyBoxWinner]
bool
(query)
	

Filter to just show variants which are buy box winners

Default value : false
search[categories]
string
(query)
	

Filter only variants in selected categories

Default value : OrderedMap {}
search[highlyDemanded]
bool
(query)
	

Filter only highly demanded variants.

Default value : false
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

EligibleVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123,
        "image": "https://dkstatic.digikala.com/123.jpg",
        "product_id": 456,
        "product_link": "https://www.digikala.com/product/456",
        "product_variant_id": 789,
        "title": "Red T-shirt XL",
        "buy_box_winner_price": 100000,
        "min_price_in_promotion": 95000,
        "min_sku_selling_price": 90000,
        "selling_price": 105000,
        "discount": 10,
        "discount_precision": 0,
        "min_category_discount": 5,
        "promotion_price": 95000,
        "max_allowable_price": 110000,
        "commission": 8,
        "selling_stock": 50,
        "promotion_limit": 5,
        "order_limit": 2,
        "status": "approved",
        "last_week_product_view_count": 1000,
        "last_week_sales_count": 100,
        "is_highly_demanded_product": true,
        "already_exist_in_incredible_promotion": false,
        "already_exist_in_same_promotion": false,
        "is_buy_box_winner": true,
        "has_commission_discount": false,
        "product_type": "product"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/eligible_v2
Scopes => promotion

See a list of eligible variants to join.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define promotion variant's sort method.

Default value : latest
search[query]
string
(query)
	

Filter by variant_id, product_id, or title.
search[onlyBuyBoxWinner]
bool
(query)
	

Filter to just show variants which are buy box winners

Default value : false
search[categories]
string
(query)
	

Filter only variants in selected categories

Default value : OrderedMap {}
search[highlyDemanded]
bool
(query)
	

Filter only highly demanded variants.

Default value : false
search[isHero]
bool
(query)
	

Filter only hero variants.

Default value : false
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

EligibleVariantsListView_V2
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "product_variant_id": 789012,
        "product_variant_title": "Premium Wireless Headphones - Black",
        "product_id": 345678,
        "product_link": "https://example.com/products/345678",
        "image_link": "https://example.com/images/products/345678.jpg",
        "buy_box_winner_price": 199900,
        "selling_price": 179900,
        "discount_precision": 0,
        "last_week_product_view_count": 1250,
        "last_week_sales_count": 85,
        "is_highly_demanded_product": true,
        "already_exists_in_incredible_promotion": false,
        "already_exist_in_same_promotion": false,
        "incentive": false,
        "is_hero": false,
        "category_name": "Premium Wireless Headphones - Black",
        "extra_offer_eligible": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/to-join
Scopes => promotion

See selected variants to join data.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[variant_ids]
array
(query)
	

product variant ids
search[promotion_id]
int
(query)
	

promotion id to join
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SelectedVariantsToJoinListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "product_variant_id": 789012,
        "product_variant_title": "Premium Wireless Headphones - Black",
        "selling_stock": 50,
        "min_promotion_limit": 12,
        "image_link": "https://example.com/images/products/789012.jpg",
        "buy_box_winner_price": 199900,
        "min_price_in_promotion": 179900,
        "selling_price": 189900,
        "commission": 5000,
        "max_allowable_price": 219900,
        "min_category_discount": 10,
        "discount_precision": 0,
        "has_commission_discount": true,
        "is_hero": true,
        "extra_offer_min_item": 5,
        "extra_offer_min_nmv": 1258000
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/{variant_id}​/commission-discount
Scopes => promotion

Get the commission discount information of a promotion variant.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
variant_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PromotionVariantCommissionDiscountObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "has_commission_discount": true,
    "commission_discount_percent": 5,
    "commission_discount_amount": 1000,
    "original_commission": 2000,
    "final_commission": 1000,
    "promotion": {
      "id": 12345,
      "title": "Mega Sale",
      "nature": "mega_promotion",
      "status": "active"
    },
    "variant": {
      "id": 789,
      "title": "Red T-shirt XL",
      "selling_price": 105000,
      "promotion_price": 95000
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ],
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/excel​/sample
Scopes => promotion

Get a sample Excel file for joining your variants to a promotion.
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SampleJoinPromotionsExcelExportView
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/promotions​/{promotion_id}​/variants​/excel
Scopes => promotion

Join variants to promotion using Excel import. Upload an Excel file to join multiple variants to a promotion.
Parameters
Try it out
Name	Description
promotion_id *
integer
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "file_id": 12
}

Responses
Code	Description	Links
200	

JoinVariantsToPromotionWithExcelForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Your file has been accepted for processing.",
    "import_request_id": 12345
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "file_id": [
      "این قسمت نباید خالی باشد"
    ],
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PLP (10)
GET
​/open-api​/v1​/pricing​/plp
Scopes => promotion

Get Seller PLPs
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[idOrTitle]
string
(query)
	

Filter search by plp id, or plp title.
search[statuses]
array
(query)
	

filter based on status.

Available values : approved, active, ended
search[startAt]
string
(query)
	

filter start time from...
search[endAt]
string
(query)
	

filter end time before...
search[isAdPLP]
bool
(query)
	

filter plps for adservice

Default value : false
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerPLPListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "title": "Summer Sale 2024",
        "platform": "digikala",
        "link": "https://www.digikala.com/product-list/plp_12345/",
        "status": "active",
        "start_at": "2024-03-19 10:00:00",
        "end_at": "2024-03-26 10:00:00",
        "isadplp": false,
        "variants_count": 50,
        "total_discount": 20
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/pricing​/plp
Scopes => promotion

Delete a PLP promotion by its ID.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "promotion_id": 67890
}

Responses
Code	Description	Links
200	

PLPDeleteForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success."
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotionId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/plp
Scopes => promotion

Create a new PLP promotion with the specified parameters.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "title": "My PLP Promotion",
  "platform": "site_all",
  "startAt": "2024-08-11T09:06:34.000Z",
  "endAt": "2024-08-21T09:06:34.000Z",
  "isAdPLP": false
}

Responses
Code	Description	Links
200	

PLPCreateForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "PLP promotion created successfully.",
    "id": 106261085
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "platform": [
      "این قسمت نباید خالی باشد"
    ],
    "startAt": [
      "این قسمت نباید خالی باشد"
    ],
    "endAt": [
      "این قسمت نباید خالی باشد"
    ],
    "isAdPLP": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/pricing​/plp
Scopes => promotion

Edit an existing PLP promotion with the specified parameters.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "promotion_id": 67890,
  "title": "My PLP Promotion",
  "platform": "site_all",
  "startAt": "2024-06-11T09:06:34.000Z",
  "endAt": "2024-08-11T09:06:34.000Z",
  "isAdPLP": false
}

Responses
Code	Description	Links
200	

PLPEditForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success."
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotionId": [
      "این قسمت نباید خالی باشد"
    ],
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "startAt": [
      "این قسمت نباید خالی باشد"
    ],
    "endAt": [
      "این قسمت نباید خالی باشد"
    ],
    "isAdPLP": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/plp​/{promotion_id}
Scopes => promotion

Get a PLP detail
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
productOrVariantId
string
(query)
	

filter a product or variant
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerPLPView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "imagelink": "https://dkstatics-public.digikala.com/digikala-products/...",
        "productid": 12121212,
        "productlink": "https://www.digikala.com/product/dkp-12121212/",
        "productvariantid": 3700502,
        "productvarianttitle": "some title",
        "producttitle": "another title",
        "categorytitle": "اسکاچ و سیم ظرفشویی",
        "supplycategorytitle": "نظافت",
        "sellingprice": 310000,
        "rrpprice": 330000,
        "lastweekproductviewcount": 8,
        "lastweeksalescount": 2,
        "size": "",
        "color": {
          "title": "نقره ای",
          "hexCode": "#dedede"
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
DELETE
​/open-api​/v1​/pricing​/plp​/variants
Scopes => promotion

Delete one or more variants from a PLP promotion.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "promotion_id": 67890,
  "variant_ids": [
    123456,
    123457
  ]
}

Responses
Code	Description	Links
200	

PLPDeleteVariantsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success."
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "productVariantIds": [
      "این قسمت نباید خالی باشد"
    ],
    "promotionId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/plp​/variants​/eligible
Scopes => promotion

Get Seller Eligible Variants to Add in PLP
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : latest, price_low, price_high, earliest

Default value : latest
order
string
(query)
	

Define list sort order.

Default value : asc
search[onlyBuyBoxWinner]
bool
(query)
	

filter to show only variants which are buy box winners of their products.
search[idOrTitle]
string
(query)
	

filter variant/product id or product title
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PLPEligibleVariantsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "latest",
      "sort_order": "asc",
      "sort_columns": [
        "latest",
        "price_low",
        "price_high",
        "earliest"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "categorytitle": "Women's analog watches",
        "color": {
          "title": "Black",
          "hexCode": "#000000"
        },
        "imagelink": "https://example.com/image.jpg",
        "lastweekproductviewcount": 150,
        "lastweeksalescount": 25,
        "productid": 12345678,
        "productlink": "https://example.com/product/123",
        "producttitle": "Women's analog wristwatch",
        "productvariantid": 87654321,
        "productvarianttitle": "Women's analog wristwatch model X | Authenticity guarantee",
        "rrpprice": 1000000,
        "sellingprice": 950000,
        "size": "Medium",
        "supplycategorytitle": "Women's watches"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/plp​/excel​/import​/sample
Scopes => promotion

Get a sample Excel file for joining your variants to a plp.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PLPSampleExcelExportView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "excelFile": {
      "name": "plp_sample_template.xlsx",
      "content": "base64_encoded_excel_content",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/plp​/excel​/{promotion_id}
Scopes => promotion

export PLP for a given promotion id
Parameters
Try it out
Name	Description
promotion_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

PLPExcelExportView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "excelFile": {
      "name": "plp_export_20240319.xlsx",
      "content": "base64_encoded_excel_content",
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "promotion_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/plp​/excel
Scopes => promotion

Add or edit a PLP promotion and add variants using Excel import. Upload an Excel file to create or update a PLP promotion.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "title": "My PLP Promotion",
  "platform": "site_all",
  "startAt": "2024-08-11T09:06:34.000Z",
  "endAt": "2024-08-11T09:06:34.000Z",
  "isAdPLP": false,
  "promotionId": 67890,
  "fileId": 123
}

Responses
Code	Description	Links
200	

PLPACreateEditWithExcelForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Your file has been accepted for processing.",
    "import_request_id": 12345,
    "promotionId": 67890
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "fileId": [
      "این قسمت نباید خالی باشد"
    ],
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "platform": [
      "این قسمت نباید خالی باشد"
    ],
    "startAt": [
      "این قسمت نباید خالی باشد"
    ],
    "endAt": [
      "این قسمت نباید خالی باشد"
    ],
    "isAdPLP": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Voucher (6)
GET
​/open-api​/v1​/pricing​/vouchers
Scopes => voucher

Get Seller Vouchers
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[title]
string
(query)
	

Filter search by voucher title.
search[status]
string
(query)
	

filter based on status.
search[startAt]
string
(query)
	

filter start time from...
search[endAt]
string
(query)
	

filter end time before...
search[isPrivate]
boolean
(query)
	

filter private vouchers
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerVoucherListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 101,
        "title": "Red T-Shirt - Large",
        "product_id": 555,
        "product_link": "https://example.com/products/555",
        "image_link": "https://example.com/images/products/555.jpg",
        "category_title": "Apparel",
        "stock": 200,
        "last_week_product_view_count": 350,
        "last_week_product_sales_count": 25,
        "is_buy_box_winner": true
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/pricing​/vouchers
Scopes => voucher

Create a new voucher for the seller. Returns the generated voucher code.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "productIds": [
    1,
    2,
    3
  ],
  "title": "Summer Sale Voucher",
  "limit": 10,
  "voucherTypeId": 1,
  "type": "percentage",
  "percentage": 10,
  "max_discount": 50000,
  "discount": 20000,
  "min_price_discount_activation": 100000,
  "startAt": "2024-08-27T11:21:17.017Z",
  "endAt": "2024-08-28T11:21:17.017Z",
  "isPrivate": true
}

Responses
Code	Description	Links
200	

SellerVoucherCreateForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "code": "ABC123XYZ"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "limit": [
      "این قسمت نباید خالی باشد"
    ],
    "startAt": [
      "این قسمت نباید خالی باشد"
    ],
    "endAt": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PUT
​/open-api​/v1​/pricing​/vouchers
Scopes => voucher

Edit an existing voucher for the seller.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "newProductIds": [
    4,
    5,
    6
  ],
  "deletedProductIds": [
    1,
    2,
    3
  ],
  "title": "Updated Voucher Title",
  "limit": 20,
  "voucherTypeId": 2,
  "voucherId": 123,
  "startAt": "2024-09-01T00:00:00.000Z",
  "endAt": "2024-09-30T23:59:59.999Z",
  "isVisible": true,
  "isPrivate": true
}

Responses
Code	Description	Links
200	

SellerVoucherEditForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Voucher edited successfully."
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "title": [
      "این قسمت نباید خالی باشد"
    ],
    "voucherTypeId": [
      "این قسمت نباید خالی باشد"
    ],
    "voucherId": [
      "این قسمت نباید خالی باشد"
    ],
    "limit": [
      "این قسمت نباید خالی باشد"
    ],
    "startAt": [
      "این قسمت نباید خالی باشد"
    ],
    "endAt": [
      "این قسمت نباید خالی باشد"
    ],
    "isVisible": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/vouchers​/types
Scopes => voucher

Get Active Voucher types
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[type]
string
(query)
	

filter based on type.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerVoucherTypesListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1,
        "type": "percentage",
        "percentage": 20,
        "max_discount": 50000,
        "min_price_to_active_discount": 200000,
        "discount": 30000
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/vouchers​/{voucher_id}
Scopes => voucher

Get a Voucher detail
Parameters
Try it out
Name	Description
voucher_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerVoucherDetailView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "products": [
      {
        "id": 123456,
        "productId": 789012,
        "title": "Premium Wireless Headphones",
        "productLink": "https://example.com/products/789012",
        "imageLink": "https://example.com/images/products/789012.jpg",
        "categoryTitle": "Electronics",
        "isBuyBoxWinner": true,
        "stock": 50,
        "lastWeekProductViewCount": 1200,
        "lastWeekProductSalesCount": 85
      }
    ],
    "voucher": {
      "id": 111222,
      "title": "Summer Sale 2024",
      "code": "SUMMER2024",
      "startAt": "2024-06-01T00:00:00Z",
      "endAt": "2024-06-30T23:59:59Z",
      "limit": 1000,
      "used": 250,
      "voucherType": {
        "id": 1,
        "type": "percentage",
        "percentage": 20,
        "maxDiscount": 50000
      },
      "status": "active",
      "isAdvertiseActive": true,
      "isEditActive": true,
      "isVisible": true,
      "plpLink": "https://example.com/vouchers/SUMMER2024"
    },
    "totalStock": 500
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "voucher_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/pricing​/vouchers​/variants​/eligible
Scopes => voucher

Get Seller Vouchers
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : latest, price_low, price_high, earliest

Default value : latest
order
string
(query)
	

Define list sort order.

Default value : asc
search[query]
string
(query)
	

Filter search by dkpc_title/dkp_id/dkpc_id.
search[categories]
string
(query)
	

filter based on categories.
search[onlyBuyBoxWinner]
bool
(query)
	

Filter to just show variants which are buy box winners

Default value : false
search[type]
string
(query)
	

which type of voucher

Default value : percentage
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerVoucherEligibleVariantListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "latest",
      "sort_order": "asc",
      "sort_columns": [
        "latest",
        "price_low",
        "price_high",
        "earliest"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "product_id": 789012,
        "title": "Premium Wireless Headphones",
        "product_link": "https://example.com/products/789012",
        "image_link": "https://example.com/images/products/789012.jpg",
        "category_title": "Electronics",
        "stock": 50,
        "last_week_product_view_count": 1200,
        "last_week_product_sales_count": 85,
        "avg_selling_price": 850000,
        "is_buy_box_winner": true
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Price Stats (1)
GET
​/open-api​/v1​/pricing​/price-stats​/{variant_id}​/boundary
Scopes => promotion, variant

provides a min and a max allowable selling price of default price (and promotion price if provided)
Parameters
Try it out
Name	Description
variant_id *
(path)
	
promotion_id
integer
(query)
	

check boundary in a provided promotion
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellingPriceBoundaryObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "default_price_boundary": {
      "min_allowed_price": 10000,
      "max_allowed_price": 20000
    },
    "promotion_price_boundary": {
      "min_allowed_price": 10000,
      "max_allowed_price": 20000
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Multi-Pricing (1)
GET
​/open-api​/v1​/pricing​/multi-pricing​/estimate
Scopes => variant

multi pricing estimation
Parameters
Try it out
Name	Description
variant_id *
integer
(query)
	

The unique identifier of the product variant for which multi-pricing estimation (cash and credit prices) will be calculated
selling_price *
integer
(query)
	

The cash selling price in Rials that the seller wants to set for the product (used as base price for calculating credit pricing and discount percentage)
rrp_price *
integer
(query)
	

The Recommended Retail Price (RRP) in Rials - the original reference price before discount, used to calculate discount percentages for both cash and credit pricing
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

MultiPricingEstimateObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "cash_selling_price": 10000,
    "cash_rrp_price": 10000,
    "cash_discount": 10000,
    "credit_selling_price": 10000,
    "credit_rrp_price": 10000,
    "credit_discount": 10000,
    "discount_precision": 0,
    "credit_increase_percentage": 10000
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "variant_id": [
      "این قسمت نباید خالی باشد"
    ],
    "selling_price": [
      "این قسمت نباید خالی باشد"
    ],
    "rrp_price": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Search Ads (21)
GET
​/open-api​/v1​/search-ads​/campaigns
Scopes => search_ads
POST
​/open-api​/v1​/search-ads​/campaigns
Scopes => search_ads
GET
​/open-api​/v1​/search-ads​/campaigns​/{campaignId}
Scopes => search_ads
GET
​/open-api​/v1​/search-ads​/campaigns​/recommended-products
Scopes => search_ads
PUT
​/open-api​/v1​/search-ads​/campaigns​/{campaign_id}
Scopes => search_ads
PATCH
​/open-api​/v1​/search-ads​/campaigns​/{campaignId}​/status
Scopes => search_ads
GET
​/open-api​/v1​/search-ads​/v2​/products
Scopes => search_ads

List of seller products available for search ads campaigns.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
enum
(query)
	

Sort column. Allowed values: id, created_at, latest, best_seller, highest_cr, most_visited, most_popular, fastest_shipping, highest_discount, price_high_low, price_low_high, recommended, ai_chosen.

Available values : id, created_at, latest, best_seller, highest_cr, most_visited, most_popular, fastest_shipping, highest_discount, price_high_low, price_low_high, recommended, ai_chosen

Default value : id
order
string
(query)
	

Define list sort order.

Default value : desc
search[q]
string
(query)
	

Search param. can be string, product IDs list comma separated, dkp-pid

Default value :
search[category_filter]
integer
(query)
	

category id to filter products by.
search[campaign_id]
integer
(query)
	

campaign id to filter products by.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsProductsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_id": 14761703,
        "title": "شارژر دیواری 30 وات",
        "category_id": 1271,
        "category_name": "شارژر تبلت و موبایل",
        "image_url": "https://dkstatics-public.digikala.com/digikala-products/example.jpg",
        "is_eligible": true,
        "ineligible_reason": null,
        "ai_chosen": false,
        "ai_score": 0,
        "ai_chosen_reason": null
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/setting
Scopes => search_ads

Get bid amount slider bounds and budget limits for the given category ids.
Parameters
Try it out
Name	Description
category_ids[]
integer
(query)
	

Repeatable query param of category ids, e.g. category_ids[]=123&category_ids[]=456.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsBidAmountBoundsByCategoryObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "bounds": [
      {
        "category_id": 1271,
        "points": [
          3000,
          4000,
          5000
        ],
        "offered_price": 4500
      }
    ],
    "now": "2026-07-29 16:56:44",
    "now_iso8601": "2026-07-29T16:56:44+03:30",
    "now_moment_js": "2026-07-29T16:56:44+03:30",
    "daily_budget_max": 10000000000,
    "daily_budget_min": 2000000,
    "daily_budget_min_clicks": 10,
    "total_budget_max": 10000000000,
    "total_budget_min": 4000000,
    "total_budget_min_clicks": 20
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/search-ads​/v2​/campaigns
Scopes => search_ads

Create a campaign.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "campaign": {
    "title": "کمپین ۷ مرداد - ۱۶:۵۱",
    "products": [
      {
        "product_id": 7849447,
        "bid_amount": 10000
      },
      {
        "product_id": 14761703,
        "bid_amount": 10000
      }
    ],
    "start_date": "2026-07-29T16:56:44+03:30",
    "end_date": "2026-10-29T16:56:44+03:30",
    "payment_method": "wallet"
  }
}

Responses
Code	Description	Links
200	

SearchAdsCreateCampaignForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "message": "Campaign successfully created."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/campaigns
Scopes => search_ads

List of seller campaigns.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
enum
(query)
	

Define list sort column. Allowed values: id, title, start_date, end_date, status, created_at, updated_at.

Available values : id, title, start_date, end_date, status, created_at, updated_at

Default value : status
order
string
(query)
	

Define list sort order.

Default value : desc
search[status]
string
(query)
	

Campaign status filter. Allowed values: pending, running, paused, ended.

Default value :
search[start_date]
date
(query)
	

Campaign start date filter.

Default value :
search[end_date]
date
(query)
	

Campaign end date filter.

Default value :
search[campaign_id]
integer
(query)
	

Campaign id filter.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsCampaignsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 136,
        "title": "کمپین ۹ اردیبهشت - ۱۱:۸",
        "seller_id": 12345,
        "start_date": "2026-07-29 16:56:44",
        "end_date": "2026-10-29 16:56:44",
        "status": "running",
        "reason": "running_started_by_seller",
        "daily_budget": 500000,
        "total_budget": 5000000,
        "used_budget": {
          "today": 120000,
          "total": 850000
        },
        "payment_method": "wallet",
        "pacing_info": {},
        "created_at": "2026-07-22 10:00:00",
        "updated_at": "2026-07-29 11:00:00"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}
Scopes => search_ads

Get campaign details, including products.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsCampaignObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 136,
    "title": "کمپین ۹ اردیبهشت - ۱۱:۸",
    "seller_id": 12345,
    "start_date": "2026-07-29 16:56:44",
    "end_date": "2026-10-29 16:56:44",
    "status": "running",
    "reason": "running_started_by_seller",
    "daily_budget": 500000,
    "total_budget": 5000000,
    "used_budget": {
      "today": 120000,
      "total": 850000
    },
    "payment_method": "wallet",
    "pacing_info": {},
    "created_at": "2026-07-22 10:00:00",
    "updated_at": "2026-07-29 11:00:00",
    "products": [
      {
        "id": 12,
        "product_id": 14761703,
        "seller_id": 12345,
        "active": true,
        "dkp": 14761703,
        "title": "شارژر دیواری 30 وات",
        "image": "https://dkstatics-public.digikala.com/digikala-products/example.jpg",
        "category": {
          "id": 1271,
          "name": "شارژر تبلت و موبایل"
        },
        "bid_amount": 5000,
        "has_optimized_bid_offer": false,
        "optimized_bid_offer": 0
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}
Scopes => search_ads

Update a campaign.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "campaign": {
    "title": "کمپین ۷ مرداد - ۱۶:۵۱",
    "products": [
      {
        "product_id": 7849447,
        "bid_amount": 10000
      },
      {
        "product_id": 14761703,
        "bid_amount": 10000
      }
    ],
    "start_date": "2026-07-29T16:56:44+03:30",
    "end_date": "2026-09-29T16:56:44+03:30",
    "payment_method": "wallet"
  }
}

Responses
Code	Description	Links
200	

SearchAdsUpdateCampaignForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "message": "Campaign successfully updated."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/report
Scopes => search_ads

Get a campaign report.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
start
string
(query)
	

Optional report start date.
end
string
(query)
	

Optional report end date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsCampaignReportObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaignId": 138,
    "sellerId": 12345,
    "clicks": 120,
    "impressions": 4500,
    "conversions": 15,
    "conversionItemsCount": 18,
    "conversionTotalOrderPayablePrice": 2500000,
    "totalBidPrice": 350000,
    "ctrPercent": 2.66,
    "crPercent": 12.5,
    "start": "2026-07-01",
    "end": "2026-07-31",
    "campaignDateReportDTOMap": {
      "additionalProp1": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      },
      "additionalProp2": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      },
      "additionalProp3": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      }
    },
    "campaignProductReportDTOMap": {
      "additionalProp1": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      },
      "additionalProp2": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      },
      "additionalProp3": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/overview
Scopes => search_ads

Get a campaign overview. Metric field names are camelCase, matching the ads reporting service.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
start
string
(query)
	

Optional overview start date.
end
string
(query)
	

Optional overview end date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsCampaignOverviewObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaignId": 138,
    "sellerId": 12345,
    "clicks": 120,
    "impressions": 4500,
    "conversions": 15,
    "conversionItemsCount": 18,
    "conversionTotalOrderPayablePrice": 2500000,
    "totalBidPrice": 350000,
    "ctrPercent": 2.66,
    "crPercent": 12.5,
    "start": "2026-07-01",
    "end": "2026-07-31",
    "campaignDateReportDTOMap": {
      "additionalProp1": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      },
      "additionalProp2": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      },
      "additionalProp3": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "date": "string"
      }
    },
    "campaignProductReportDTOMap": {
      "additionalProp1": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      },
      "additionalProp2": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      },
      "additionalProp3": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "start": "string",
        "end": "string",
        "productDateReportDTOMap": {}
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/products​/{product_id}​/overview
Scopes => search_ads

Get a campaign product overview. Metric field names are camelCase, matching the ads reporting service.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
product_id *
integer
(path)
	

Product id.
start
string
(query)
	

Optional overview start date.
end
string
(query)
	

Optional overview end date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsCampaignProductOverviewObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaignId": 138,
    "sellerId": 12345,
    "clicks": 40,
    "impressions": 1500,
    "conversions": 5,
    "conversionItemsCount": 6,
    "conversionTotalOrderPayablePrice": 850000,
    "totalBidPrice": 120000,
    "ctrPercent": 2.66,
    "crPercent": 12.5,
    "productId": 14761703,
    "start": "2026-07-01",
    "end": "2026-07-31",
    "productDateReportDTOMap": {
      "additionalProp1": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "date": "string"
      },
      "additionalProp2": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "date": "string"
      },
      "additionalProp3": {
        "campaignId": 0,
        "sellerId": 0,
        "clicks": 0,
        "impressions": 0,
        "conversions": 0,
        "conversionItemsCount": 0,
        "conversionTotalOrderPayablePrice": 0,
        "totalBidPrice": 0,
        "ctrPercent": 0,
        "crPercent": 0,
        "productId": 0,
        "date": "string"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/products​/{product_id}​/overview
Scopes => search_ads

Get a product overview. Metric field names are camelCase, matching the ads reporting service.
Parameters
Try it out
Name	Description
product_id *
integer
(path)
	

Product id.
start
string
(query)
	

Optional overview start date.
end
string
(query)
	

Optional overview end date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsProductOverviewObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaignId": 138,
    "sellerId": 12345,
    "clicks": 40,
    "impressions": 1500,
    "conversions": 5,
    "conversionItemsCount": 6,
    "conversionTotalOrderPayablePrice": 850000,
    "totalBidPrice": 120000,
    "ctrPercent": 2.66,
    "crPercent": 12.5,
    "productId": 14761703,
    "start": "2026-07-01",
    "end": "2026-07-31"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/search-ads​/v2​/seller​/overview
Scopes => search_ads

Get the authenticated seller overview. Metric field names are camelCase, matching the ads reporting service. campaignId may be null because this is seller-level data.
Parameters
Try it out
Name	Description
start
string
(query)
	

Optional overview start date.
end
string
(query)
	

Optional overview end date.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsSellerOverviewObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaignId": null,
    "sellerId": 12345,
    "clicks": 320,
    "impressions": 12000,
    "conversions": 40,
    "conversionItemsCount": 48,
    "conversionTotalOrderPayablePrice": 6800000,
    "totalBidPrice": 980000,
    "ctrPercent": 2.66,
    "crPercent": 12.5,
    "start": "2026-07-01",
    "end": "2026-07-31"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/status​/{status}
Scopes => search_ads

Change campaign status. Allowed path status values: running, paused, ended.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
status *
string
(path)
	

New campaign status. Seller-allowed values: running, paused, ended.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SearchAdsChangeCampaignStatusForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "status": "paused",
    "reason": "paused_by_seller",
    "message": "Campaign status successfully updated."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/bid
Scopes => search_ads

Change a campaign product bid amount.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "campaign": {
    "product_id": 14761703,
    "bid_amount": 10000
  }
}

Responses
Code	Description	Links
200	

SearchAdsChangeBidAmountForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "product_id": 287,
    "bid_amount": 10000,
    "message": "Campaign bid amount successfully updated."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/products
Scopes => search_ads

Add products to an existing campaign.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "products": [
    {
      "product_id": 7849447,
      "bid_amount": 10000
    },
    {
      "product_id": 14761703,
      "bid_amount": 10000
    }
  ]
}

Responses
Code	Description	Links
200	

SearchAdsAddCampaignProductsForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "product_ids": [
      7849447,
      14761703
    ],
    "message": "Campaign products successfully added."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/search-ads​/v2​/campaigns​/{campaign_id}​/products​/{product_id}​/status
Scopes => search_ads

Change the active status of a campaign product.
Parameters
Try it out
Name	Description
campaign_id *
integer
(path)
	

Campaign id.
product_id *
integer
(path)
	

Product id.
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "active": true
}

Responses
Code	Description	Links
200	

SearchAdsChangeCampaignProductStatusForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "campaign_id": 138,
    "product_id": 287,
    "active": true,
    "message": "Campaign product status successfully updated."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Commission (3)
GET
​/open-api​/v1​/commissions​/
Scopes => commission
GET
​/open-api​/v1​/dynamic-commission​/dynamic-ranges
Scopes => commission

List the seller's dynamic commission ranges per leaf category.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[my_commissions]
boolean
(query)
	

Restrict results to the categories/brands the seller has approved products in.
search[as_of]
string
(query)
	

Evaluate rule effectiveness/membership as of this point in time (ISO-8601). Defaults to now.
search[leaf_category_ids]
string
(query)
	

Comma-separated leaf category ids to restrict results to; omitted returns every leaf category.
search[main_category_ids]
string
(query)
	

Comma-separated main category ids; expanded to the leaf categories under them, intersected with leaf_category_ids when both are given.
search[brand_ids]
string
(query)
	

Comma-separated brand ids; restricts results to the leaf categories carrying a rule for one of these brands, intersected with leaf_category_ids when both are given.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CommissionRangeListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "leafCategoryId": 12345,
        "leafCategoryName": "دیجیتال",
        "supplyCategoryId": 12345,
        "supplyCategoryName": "دیجیتال",
        "minCommission": {
          "min": 10000,
          "max": 30000
        },
        "baseCommissionRate": {
          "min": 1.12,
          "max": 15.23
        },
        "extraCommissionRate": {
          "min": 1.12,
          "max": 15.23
        },
        "returnFreeCommission": {
          "min": 1.12,
          "max": 15.23
        }
      }
    ],
    "meta_data": {
      "mainCategories": [
        {
          "title": "string",
          "id": 0
        }
      ]
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/dynamic-commission​/dynamic-ranges​/{leaf_category_id}
Scopes => commission

Get the seller's dynamic commission range breakdown for one leaf category.
Parameters
Try it out
Name	Description
leaf_category_id *
(path)
	
as_of
string
(query)
	

Evaluate rule effectiveness/membership as of this point in time (ISO-8601). Defaults to now.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

CommissionRangeObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "leafCategoryId": 12345,
    "rows": [
      {
        "minCommission": 10000,
        "baseCommissionRate": 10.23,
        "extraCommissionRate": 14.23,
        "aspBucketRanges": [
          {
            "minPrice": 10000,
            "maxPrice": 33000,
            "minCommission": 10000,
            "baseCommissionRate": 10.23,
            "extraCommissionRate": 14.23
          }
        ],
        "returnFreeCommission": 1220,
        "brandIds": [
          1234,
          3213
        ],
        "brandAgnostic": true,
        "brands": [
          {
            "id": 12345,
            "name": "سامسونگ"
          }
        ],
        "exceptions": [
          {
            "dkpId": 12345,
            "variantId": 12345,
            "minCommission": 10000,
            "baseCommissionRate": 10.23,
            "extraCommissionRate": 14.23,
            "aspBucketRanges": [
              {
                "minPrice": 10000,
                "maxPrice": 33000,
                "minCommission": 10000,
                "baseCommissionRate": 10.23,
                "extraCommissionRate": 14.23
              }
            ],
            "dkpName": "موبایل سامسونگ",
            "dkpImage": "https://dkstatics-public.digikala.com/digikala-brands/12394.png?x-oss-process=image/resize,m_lfit,h_80,w_80",
            "variantName": "موبایل سامسونگ",
            "variantImage": "https://dkstatics-public.digikala.com/digikala-brands/12394.png?x-oss-process=image/resize,m_lfit,h_80,w_80"
          }
        ]
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Invoices (4)
GET
​/open-api​/v1​/invoices
Scopes => invoice

List seller invoices
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : desc
search[payout_order_status]
integer
(query)
	

for filter payout order status
search[invoice_start_date]
string
(query)
	

for filter invoice start date in format iso
search[invoice_end_date]
string
(query)
	

for filter invoice end date in format iso
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInvoiceListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "desc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 1234,
        "start_date": "2018-12-25T09:29:45.000000+03:30",
        "end_date": "2018-12-24T00:00:00.000000+03:30",
        "cash_sale_date": "2019-01-23T00:00:00.000000+03:30",
        "credit_sale_date": "1970-01-01T00:00:00.000000+03:30",
        "invoice_total_amount": 46144502,
        "payout_order_status": {
          "title": "پرداخت شده",
          "key": "paid"
        },
        "settlement_status": {
          "title": "امکان درخواست تسویه زودهنگام وجود ندارد.",
          "key": "not_applicable"
        },
        "show_early_settlement": false,
        "can_print": false,
        "is_new": true
      }
    ],
    "meta_data": {
      "last_updated_at": "2025-02-02T15:17:17.611642+03:30"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/invoices​/{invoice_id}​/details
Scopes => invoice

Invoice details
Parameters
Try it out
Name	Description
invoice_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInvoiceDetailObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "start_date": "2018-12-25T09:29:45.000000+03:30",
    "end_date": "2018-12-24T00:00:00.000000+03:30",
    "show_early_settlement": false,
    "vat_amount": -80565073,
    "show_income_factor": true,
    "can_print": false,
    "cash": {
      "maturity_date": "2023-12-02T00:00:00.000000+03:30",
      "total_amount": 2430826486,
      "status": {
        "key": "paid",
        "title": "پرداخت شده"
      }
    },
    "credit": {
      "maturity_date": null,
      "total_amount": 2430826486,
      "status": {
        "key": "paid",
        "title": "پرداخت شده"
      }
    },
    "total_income": 2400778366,
    "total_paid_amount": 2430826486,
    "payout_order_status": {
      "title": "پرداخت شده",
      "key": "paid"
    },
    "early_settlement": {
      "status": "success",
      "amount": "2430826486",
      "created_at": "2023-11-21T00:00:00.000000+03:30",
      "settlement_date": "2023-11-21T00:00:00.000000+03:30"
    },
    "sales": {
      "notations": [
        {
          "id": 1234,
          "title": "کمیسیون فروش",
          "item_count": 10,
          "total_amount": 288986359,
          "general_discount_credit": 2844,
          "general_discount_debit": null,
          "calculation_model_type": "category_based",
          "is_vat_free": true
        }
      ],
      "total_amount": 0
    },
    "sales_return": {
      "notations": [
        {
          "id": 1234,
          "title": "کمیسیون فروش",
          "item_count": 10,
          "total_amount": 288986359,
          "general_discount_credit": 2844,
          "general_discount_debit": null,
          "calculation_model_type": "category_based",
          "is_vat_free": true
        }
      ],
      "total_amount": 0
    },
    "others": {
      "notations": [
        {
          "id": 1234,
          "title": "کمیسیون فروش",
          "item_count": 10,
          "total_amount": 288986359,
          "general_discount_credit": 2844,
          "general_discount_debit": null,
          "calculation_model_type": "category_based",
          "is_vat_free": true
        }
      ],
      "total_amount": 0
    },
    "payment_deficit": {
      "sales_amount": 2589791159,
      "sales_return_amount": -2589791159,
      "others_amount": 2589791159,
      "total_amount": 2589791159
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "invoiceId": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/invoices​/{invoice_id}​/items​/{financial_notation_id}​/{calculation_type}
Scopes => invoice

List of seller invoice items detail
Parameters
Try it out
Name	Description
invoice_id *
(path)
	
financial_notation_id *
(path)
	
calculation_type *
(path)
	
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : asc
search[invoice_id]
integer
(query)
	
search[financial_notation_id]
integer
(query)
	
search[calculation_type]
string
(query)
	

FinancialNotaion calculation_model_type
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerInvoiceItemsDetailListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/invoices​/vat
Scopes => invoice

Return VAT of a Product
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "product_id": 123,
  "date": "2025-10-05",
  "price": 100000,
  "is_vat_included_in_price": true
}

Responses
Code	Description	Links
200	

Undefined
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Finance (9)
GET
​/open-api​/v1​/finance​/overview​/v2
Scopes => invoice

Seller financial overview: per-state totals, next settlement date, and sales/sales-returns breakdown. The metadata carries statuses: the status filter options as {value, label}, the same shape /transactions returns.
Parameters
Try it out
Name	Description
start_date *
string
(query)
	

ISO date (YYYY-MM-DD). Must fall within the last 3 calendar months.
end_date *
string
(query)
	

ISO date (YYYY-MM-DD). Must be >= start_date.
status
string
(query)
	

Filter by billing-event status — the values meta_data.statuses offers: those /transactions offers, less REJECTED. Accepts a single value or a comma-separated list (e.g. RELEASED,SETTLED), case-insensitive. When omitted or empty, every value meta_data.statuses offers applies. Applies to the sections, the chart and every total alike.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceOverviewV2ObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "period": {
      "start_date": "string",
      "end_date": "string"
    },
    "sales": {
      "title": "string",
      "total_amount": 0,
      "items": [
        {
          "id": 0,
          "title": "string",
          "items_count": 0,
          "amount": 0,
          "badge": {
            "type": "discount",
            "title": "string"
          }
        }
      ]
    },
    "sales_returns": {
      "title": "string",
      "total_amount": 0,
      "items": [
        {
          "id": 0,
          "title": "string",
          "items_count": 0,
          "amount": 0,
          "badge": {
            "type": "discount",
            "title": "string"
          }
        }
      ]
    },
    "chart": {
      "credit": {
        "total": 0,
        "items": [
          {
            "chart_group": "string",
            "title": "string",
            "amount": 0,
            "count": 0,
            "discount_amount": 0,
            "vat_free": true,
            "notations": [
              {
                "notation_id": 0,
                "title": "string",
                "amount": 0,
                "count": 0,
                "discount_amount": 0,
                "vat_free": true
              }
            ]
          }
        ]
      },
      "debit": {
        "total": 0,
        "items": [
          {
            "chart_group": "string",
            "title": "string",
            "amount": 0,
            "count": 0,
            "discount_amount": 0,
            "vat_free": true,
            "notations": [
              {
                "notation_id": 0,
                "title": "string",
                "amount": 0,
                "count": 0,
                "discount_amount": 0,
                "vat_free": true
              }
            ]
          }
        ]
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "start_date": [
      "این قسمت نباید خالی باشد"
    ],
    "end_date": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/transactions
Scopes => invoice

Seller transaction list with filters, sort, and pagination. transaction_time is the only sortable column and accepts asc and desc, defaulting to desc. pager.total_rows and pager.total_pages no longer count the result: finance-billing reports only whether a next page exists, so both are a floor derived from that — one row past the current page while more pages remain, and the page's own last row on the final page. Page forward until a page comes back shorter than pager.item_per_page; do not render either number as the size of the result.
Parameters
Try it out
Name	Description
search[status]
string
(query)
	

Filter by transaction status (NEW, PENDING, ACCEPTED, RELEASED, REJECTED, SETTLED). Accepts a single value or a comma-separated list (e.g. PENDING,ACCEPTED) which is forwarded to finance-billing as repeated status query params.
search[aggregation_type]
string
(query)
	

Filter by aggregation type (sale, return, delivery, ...). Accepts a single value or a comma-separated list (e.g. sale,return) which is forwarded to finance-billing as repeated aggregationType query params. See response meta_data.aggregation_types for the offered values; initial_balance is not among them, though it is still forwarded if sent.
search[search]
string
(query)
	

Free-text search across transaction identifiers (order_id, DKPC, serial, etc.). Forwarded to finance as search.
search[start_date]
string
(query)
	

ISO date (YYYY-MM-DD) — inclusive lower bound applied to each row's transaction_time (finance pendingAt).
search[end_date]
string
(query)
	

ISO date (YYYY-MM-DD) — inclusive upper bound applied to each row's transaction_time (finance pendingAt).
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceTransactionListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "transaction_time",
      "sort_order": "desc",
      "sort_columns": [
        "transaction_time"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 0,
        "unique_identifier": 0,
        "unique_identifier_tag": "string",
        "amount": 0,
        "direction": "credit",
        "discount_sum": 0,
        "aggregation_type": "string",
        "detail_page": "payment",
        "category_label": "string",
        "cart_closed_at": "string",
        "status": "string",
        "transaction_time": "string",
        "settlement_time": "string",
        "payout_transaction_id": 0,
        "is_correction": true,
        "product_id": 0,
        "product_variant_id": 0,
        "product_title": "string",
        "product_image_url": "string",
        "product_url": "string",
        "serial": "string",
        "order_shipment_id": "string"
      }
    ],
    "meta_data": {
      "statuses": [
        {
          "value": "string",
          "label": "string"
        }
      ],
      "aggregation_types": [
        {
          "value": "string",
          "label": "string"
        }
      ]
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/transactions​/rows
Scopes => invoice

Seller transaction row-level list with filters, sort, and pagination. transaction_time is the only sortable column and accepts both asc and desc, defaulting to desc. pager.total_rows and pager.total_pages no longer count the result: finance-billing reports only whether a next page exists, so both are a floor derived from that — one row past the current page while more pages remain, and the page's own last row on the final page. Page forward until a page comes back shorter than pager.item_per_page; do not render either number as the size of the result. Without start_date, finance-billing applies its own default window of the last 90 days ending today, so an unfiltered request is the last 90 days rather than the seller's whole history. Pass start_date to widen it.
Parameters
Try it out
Name	Description
search[status]
string
(query)
	

Filter by row status (PENDING, ACCEPTED, RELEASED, REJECTED, SETTLED) — the values meta_data.statuses offers, which finance-billing derives from its own enum. Single value or comma-separated list forwarded as statuses; anything outside that set is rejected downstream and surfaces as a 502.
search[notations]
string
(query)
	

Filter by notation id. Single value, comma-separated list, or repeated [] entries, forwarded to finance-billing as notationIds. See response meta_data.notations for the available ids.
search[search]
string
(query)
	

Free-text search matched by finance-billing against row identifiers (e.g. unique_identifier).
search[start_date]
string
(query)
	

ISO date (YYYY-MM-DD) — inclusive lower bound applied to each row's transaction_time (finance pendingAt).
search[end_date]
string
(query)
	

ISO date (YYYY-MM-DD) — inclusive upper bound applied to each row's transaction_time (finance pendingAt).
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceTransactionRowListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "transaction_time",
      "sort_order": "desc",
      "sort_columns": [
        "transaction_time"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 0,
        "unique_identifier": 0,
        "unique_identifier_tag": "string",
        "amount": 0,
        "direction": "credit",
        "notation_id": 0,
        "notation_name": "string",
        "cart_closed_at": "string",
        "status": "string",
        "transaction_time": "string",
        "settlement_time": "string",
        "payout_order_id": 0,
        "is_correction": true,
        "vat": 0,
        "description": "string",
        "product_id": 0,
        "product_variant_id": 0,
        "product_title": "string",
        "product_image_url": "string",
        "product_url": "string",
        "serial": "string",
        "order_shipment_id": "string"
      }
    ],
    "meta_data": {
      "statuses": [
        {
          "value": "string",
          "label": "string"
        }
      ],
      "notations": {
        "9": "جریمه کنسل شدن سفارش",
        "10": "هزینه درج محتوا",
        "22": "کمیسیون فروش - نقدی"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/transactions​/summary
Scopes => invoice

Seller per-state totals for the current Persian month, plus the next and last settlements, and the seller's payout cycle. Takes no period parameters: total and paid always cover the current month, and the pending / accepted / released states are the seller's live balance.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceTransactionSummaryObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "total": {
      "amount": 0,
      "count": 0
    },
    "pending": {
      "amount": 0,
      "count": 0
    },
    "accepted": {
      "amount": 0,
      "count": 0
    },
    "released": {
      "amount": 0,
      "count": 0
    },
    "paid": {
      "amount": 0,
      "count": 0
    },
    "next_settlement": {
      "id": 0,
      "amount": 0,
      "date": "string"
    },
    "last_settlement": {
      "id": 0,
      "amount": 0,
      "date": "string"
    },
    "payout_cycle": {
      "days": 0,
      "title": "string"
    },
    "show_early_settlement": true,
    "show_reserve_early_settlement": true,
    "hover_content_key": "string"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/transactions​/{transaction_id}
Scopes => invoice

Single transaction detail mirroring finance-billing structure.
Parameters
Try it out
Name	Description
transaction_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceTransactionObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "aggregation_type": "string",
    "category_label": "string",
    "unique_identifier": "string",
    "unique_identifier_tag": "string",
    "has_variant_info": true,
    "status": "string",
    "transaction_id": 0,
    "transaction_time": "string",
    "released_at": "string",
    "cart_closed_at": "string",
    "final_amount": 0,
    "amount_type": "string",
    "vat_sum": 0,
    "discount_sum": 0,
    "rejection_reason": "string",
    "billing_event_count": 0,
    "payout_order_tracking_code": "string",
    "reason": "string",
    "meta_data": {
      "product_id": 0,
      "product_variant_id": 0,
      "product_title": "string",
      "product_image_url": "string",
      "product_url": "string",
      "serial": "string",
      "order_shipment_id": "string"
    },
    "financial_details": [
      {
        "billing_event_id": 0,
        "debit": 0,
        "credit": 0,
        "notation_name": "string",
        "description": "string"
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "transaction_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/payouts
Scopes => invoice

Seller payout order history, filtered, sorted and paged in memory: finance-billing's /payout-orders/history accepts only the seller and whether to include pending payouts, so none of it can be pushed downstream.
Parameters
Try it out
Name	Description
search[status]
string
(query)
	

Filter by payout status — the values meta_data.statuses offers, matched case-insensitively. Single value or comma-separated list. in_queue covers finance's CALCULATED and PENDING, which read the same to a seller. A value outside the list matches nothing. Each row's status reports the same value it is matched by, so filtering on a value returns exactly the rows reporting it.
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinancePayoutListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "suggested_payout_at",
      "sort_order": "desc",
      "sort_columns": [
        "suggested_payout_at",
        "payout_date",
        "amount",
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 0,
        "amount": 0,
        "status": "string",
        "tracking_code": "string",
        "suggested_payout_at": "string",
        "payout_date": "string"
      }
    ],
    "meta_data": {
      "statuses": [
        {
          "value": "string",
          "label": "string"
        }
      ]
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/payouts​/{payout_id}
Scopes => invoice

Single payout order detail mirroring finance-billing structure.
Parameters
Try it out
Name	Description
payout_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinancePayoutObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "payout_id": 0,
    "status": "string",
    "amount": 0,
    "tracking_code": "string",
    "final_credit": 0,
    "final_debit": 0,
    "rejection_reason": "string",
    "suggested_payout_at": "string",
    "payout_date": "string",
    "billing_event_count": 0,
    "vat": {
      "amount": 0,
      "is_credit": true
    },
    "credit": [
      {
        "chart_group": "string",
        "title": "string",
        "amount": 0,
        "count": 0,
        "discount_amount": 0,
        "vat_free": true,
        "notations": [
          {
            "notation_id": 0,
            "title": "string",
            "amount": 0,
            "count": 0,
            "discount_amount": 0,
            "vat_free": true
          }
        ]
      }
    ],
    "debit": [
      {
        "chart_group": "string",
        "title": "string",
        "amount": 0,
        "count": 0,
        "discount_amount": 0,
        "vat_free": true,
        "notations": [
          {
            "notation_id": 0,
            "title": "string",
            "amount": 0,
            "count": 0,
            "discount_amount": 0,
            "vat_free": true
          }
        ]
      }
    ],
    "notations": [
      {
        "notation_id": 0,
        "notation_name": "string",
        "amount": 0,
        "is_credit": true
      }
    ],
    "early_settlements": [
      {
        "id": 0,
        "status": "string",
        "tracking_code": "string"
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "payout_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/finance​/seller-invoices
Scopes => invoice

Monthly seller invoices issued by the finance team.
Parameters
Try it out
Name	Description
search[month]
integer
(query)
	

Jalali month number (1-12). Optional, but must be sent together with year. Converted to a Gregorian start/end window for the upstream call.
search[year]
integer
(query)
	

Jalali year (e.g. 1404). Optional, but must be sent together with month.
search[invoice_id]
integer
(query)
	

Filter by a specific invoice id (maps to upstream id).
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

FinanceSellerInvoiceListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 0,
        "start_date": "string",
        "end_date": "string",
        "final_amount": 0,
        "amount_type": "credit",
        "tax_id": "string"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/finance​/transactions​/export​/excel
Scopes => invoice

Requests an excel export of the seller's finance transactions. The file is built in the background and then emailed to the seller and listed under /files/exports.
Parameters
Try it out
Name	Description
start_date
string
(query)
	

format -> Y-m-d. Defaults to the first day of the current Persian month.
end_date
string
(query)
	

format -> Y-m-d. Defaults to the last day of the current Persian month.
statuses
string
(query)
	

Filter by billing-event status (PENDING, ACCEPTED, RELEASED, REJECTED, SETTLED). Single value or comma-separated list (e.g. PENDING,ACCEPTED), forwarded to finance-billing as statuses. Omit to include every status. Note: finance-billing's excel-export query unconditionally excludes REJECTED events before applying this filter, so statuses=REJECTED always returns zero rows.
notation_ids
string
(query)
	

Single value or comma-separated list, interpreted according to source. When source is per_notations, these are notation ids and are forwarded to finance-billing as-is. When source is per_aggregations, these are FinanceAggregationType codes (e.g. sale, return, delivery) and are resolved locally to the notation ids that belong to them before being forwarded. Omit to include every notation.
search[status]
string
(query)
	

Same as the transaction list: billing-event status, single value or comma-separated list. Replaces statuses.
search[notations]
string
(query)
	

Same as the transaction rows list: notation id, single value or comma-separated list. Read according to source. Replaces notation_ids.
search[aggregation_type]
string
(query)
	

Same as the transaction list: aggregation type (sale, return, delivery, ...), single value or comma-separated list, resolved locally to the notations of those types. Combined with search[notations] it keeps only the notations that belong to those types.
source
string
(query)
	

How to interpret search[notations] / notation_ids. Defaults to per_notations when notation_ids is set without it.

Available values : per_notations, per_aggregations
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{}

Responses
Code	Description	Links
200	

FinanceTransactionsExcelExportForm
	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Profile (9)
GET
​/open-api​/v1​/profile
Scopes => profile

Get seller's profile data in bulk or mini format.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "seller_id": 12345,
    "hashed_seller_id": "Zm9vYmFyMTIzNDU",
    "wallet_credit": 19990,
    "seller_name": "فروشگاه علی",
    "secondary_business_name": "فروشگاه علی",
    "seller_rating": 2.5,
    "is_private": true,
    "new_notifications": 172,
    "new_questions": 640,
    "verification": {
      "hoda_modal": "hoda_none",
      "is_under_18": false,
      "emta_modal": "emta_none"
    },
    "registration_status": "approved",
    "rejection_reasons": [
      "دلیل ۱"
    ],
    "rejection_reasons_extra_message": "دلیل بیشتر",
    "logo_rejection_reason": "یه چیزی هست",
    "description_rejection_reason": "یه دلیل دیگه",
    "register_phone": {
      "submitted": true,
      "seen_warning_at": "1991-08-29T00:00:00.000000+03:30",
      "restricted": false
    },
    "contract_status": {
      "signed": true,
      "expired": false,
      "restricted": false
    },
    "has_password_expired": false,
    "is_shipment_list_visible": true,
    "first_name": "علی",
    "last_name": "موسوی",
    "gender": "male",
    "email": "salimousavi70@gmail.com",
    "phone": 989123456789,
    "state": "تهران",
    "city": "تهران",
    "birthday": "1991-08-29T00:00:00.000000+03:30",
    "company": "ایده پردازان دیجیکالا",
    "isNewSeller": false,
    "national_id": "0012345678",
    "registration_metadata": {
      "is_rural": false,
      "is_brand": true,
      "is_instagram_shop": true
    },
    "metadata": {
      "tier": "A",
      "register_status": "string",
      "status": "string",
      "supply_categories": [
        112233
      ],
      "open_api_token_status": "confirmed",
      "has_sbs_setting": true,
      "has_nearby_setting": false,
      "city_id": 123,
      "platform": "app"
    },
    "muchat_identity_token": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiMTIzNDU2In0.signature",
    "subscription": {
      "plan_name": "Pro",
      "status": "ACTIVE",
      "is_trial": false
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/business
Scopes => profile

Get profile business data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileBusinessObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "business_type": "private",
    "first_name": "مريم",
    "last_name": "موسوي",
    "national_id": "0012345678",
    "register_phone": "989123456789",
    "mobile_phone": "989123456789",
    "email": "test@gmail.com",
    "verification_status": {
      "national_id": true,
      "mobile_phone": true,
      "register_phone": true,
      "email": true,
      "company_name": true,
      "company_type": true,
      "company_registration_number": true,
      "company_national_id_number": true,
      "company_economic_number": true,
      "company_authorized_representative": true
    },
    "company_name": "شرکت میهن",
    "company_type": {
      "key": "public",
      "title": "سهامی عام"
    },
    "company_registration_number": "123456",
    "company_national_id_number": "140012345567",
    "company_economic_number": "140012345567",
    "company_authorized_representative": "علی موسوی"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
PATCH
​/open-api​/v1​/profile​/business
Scopes => profile

Edit seller business data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "type": "real",
  "first_name": "علی",
  "last_name": "موسوی",
  "national_id": "0012345678",
  "company_name": "علی کمپانی",
  "company_type": "ltd",
  "company_registration_number": "123214552",
  "company_national_id_number": "1232144123",
  "company_economic_number": "12312412412",
  "company_authorized_representative": "علی موسوی"
}

Responses
Code	Description	Links
200	

UpdateBusinessDataForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "success"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "type": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/store
Scopes => profile

Get seller store data
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileStoreObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "seller_type": "private",
    "seller_code": 12345,
    "business_name": "فروشگاه علی",
    "secondary_business_name": "فروشگاه علی",
    "page_slug": "ali-shop",
    "cover_color_top": "#30A69C",
    "cover_color_bottom": "#286390",
    "description": {
      "description": "فروشگاه خوبیه",
      "status": "new",
      "rejection_reason": "خوب توضیح ندادی"
    },
    "holidays": [
      {
        "id": 12345,
        "date": {
          "date": "2024-08-20 00:00:00.000000",
          "timezone_type": 3,
          "timezone": "Asia/Tehran"
        },
        "active": true,
        "live": false
      }
    ],
    "workdays": [
      {
        "id": 12345,
        "date": {
          "date": "2024-08-16 00:00:00.000000",
          "timezone_type": 3,
          "timezone": "Asia/Tehran"
        },
        "type": "ship_by_seller",
        "active": true,
        "is_not_passed": true,
        "applied": false
      }
    ],
    "phone": "021-8888888",
    "website": "https://alistore.com",
    "logo": {
      "file": "https://dkstatic-public-demo.digikala.com/digikala-marketplace-seller-logo/89b8d22868f8e247ed19ad15723bdb2b2070dc19_1723277982.jpg",
      "status": "new",
      "rejection_reason": "خوب نیست"
    },
    "registration_status": {
      "is_logo_approved": false,
      "is_description_approved": false,
      "is_phone_valid": true,
      "is_business_name_valid": true
    },
    "business_name_changed_at": "2026-06-16T13:09:39Z",
    "brand_name": "Acme",
    "ig_handle": "acme.store",
    "business_name_validation_status": {
      "key": "approved",
      "title": "تایید شده"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/address
Scopes => profile

Get seller addresses data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileAddressListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "city": {
          "id": 123,
          "name": "تهران",
          "latitude": 35.75,
          "longitude": 51.375
        },
        "state": {
          "id": 12,
          "name": "تهران",
          "latitude": 35.6943,
          "longitude": 51.42151
        },
        "title": "انبار ۱",
        "address": "خیابان انقلاب خیابان ولیعصر، پارک ساعی",
        "house_number": " ۱۱۰ زنگ ۱ و ۲",
        "latitude": 35.7,
        "longitude": 51.397,
        "postal_code": 1314754433
      }
    ],
    "meta_data": {
      "can_delete_address": true
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/warehouse
Scopes => profile

Get seller's profile warehouse address data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileWarehouseAddressListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "title": "انبار تست",
        "latitude": 35.7332,
        "longitude": 51.3906,
        "description": "جهت تست ساخته شده است",
        "postal_code": 1234567890,
        "address": "تهران، بزرگراه کردستان، فرشی مقدم",
        "house_number": 123,
        "city": {
          "id": 123,
          "name": "تهران",
          "latitude": 35.75,
          "longitude": 51.375
        },
        "state": {
          "id": 123,
          "name": "تهران",
          "latitude": 35.69439,
          "longitude": 51.42151
        },
        "phone": "02188888888",
        "is_return_address": false
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/document
Scopes => profile

Get seller documents data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileDocumentObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "business_type": "private",
    "types": [
      {
        "id": 123,
        "text": "آگهی آخرین تغییرات روزنامه رسمی",
        "has_expired_date": false
      }
    ],
    "files": [
      {
        "id": 12345,
        "document_title": "کارت ملی",
        "image_src": "https://dkstatic-public-demo.digikala.com/digikala-marketplace-sellers-documents/65709de1064cc2b104c82282af999e2d5_17237946.jpg",
        "status": {
          "key": "new",
          "title": "در حال بررسی"
        },
        "rejection_reason": "مدارک شما به علت کیفیت پایین مدارک ارسالی مورد تایید مرکز فروشندگان دیجی کالا قرار نگرفت",
        "expires_at_persian": "1402/09/15",
        "document_id": 123,
        "unlimited": false
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/training
Scopes => profile

Get seller training data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfileTrainingObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "finished",
    "date": {
      "date": "2024-08-16 00:00:00.000000",
      "timezone_type": 3,
      "timezone": "Asia/Tehran"
    },
    "type": "webinar",
    "has_finished_survey": true,
    "has_one_more_person": false,
    "has_sales_experience": false,
    "class_link": "https://classlink.ir",
    "tutorial_videos": [
      {
        "title": "همه چیز در مورد درج کالا",
        "link": "https://www.aparat.com/v/46dD?playlist=16148",
        "duration": "25:27"
      }
    ]
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/profile​/performance
Scopes => profile

Get seller performance data.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

ProfilePerformanceObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "five_start_rate": 2.5,
    "customer_statisfaction": {
      "rate": 89,
      "rate_count": 165447
    },
    "summary": {
      "delivered_on_time_percentage": 94.72,
      "not_canceled_percentage": 90.64,
      "not_returned_percentage": 99.87
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Questions & Answers (3)
GET
​/open-api​/v1​/questions
Scopes => question

Get a list of customer's questions from seller.
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 50
sort
string
(query)
	

Define list sort column.

Available values : id, most_viewed, best_selling, newest_product, most-answers, least-answers

Default value : id
order
string
(query)
	

Define list sort order.

Default value : desc
search[answer-status]
string
(query)
	

(comma-seperated) statuses of seller answer. items: unanswered, pending, rejected, verified
search[question-date-from]
string
(query)
	

Filter questions from this timestamp onwards. Supports both MySQL DATETIME format (YYYY-MM-DD HH:MM:SS) and Unix timestamp (10-digit numeric string)
search[question-date-to]
string
(query)
	

Filter questions up to this timestamp. Supports both MySQL DATETIME format (YYYY-MM-DD HH:MM:SS) and Unix timestamp (10-digit numeric string)
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

QuestionAndAnswerListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "desc",
      "sort_columns": [
        "id",
        "most_viewed",
        "best_selling",
        "newest_product",
        "most-answers",
        "least-answers"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 12345,
        "body": "رنگ‌رنگ قهوه ایشو دارین‌؟",
        "date": "2023-12-21",
        "answer": {
          "id": 12345,
          "body": "سلام. بله کاملا قابل سایز می باشد. انتهای دستبند به صورت آسانسوری سایز می شود.",
          "files": [
            ""
          ],
          "status": {
            "title": "تایید شده",
            "key": "confirmed"
          },
          "date": "2023-10-08"
        },
        "answer_count": 1,
        "product": {
          "id": 109227443,
          "title": "دستبند نقره مردانه",
          "link": "https://www.digikala.com/product/dkp-10955744/",
          "photo": "https://dkstatics-public.digikala.com/digikala-products/bfeb186e6971e740120ea602948f763c93561f16_1680025602.jpg"
        },
        "user": "علی موسوی"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/questions​/{question_id}
Scopes => question

Get a customer question details that assigned to seller.
Parameters
Try it out
Name	Description
question_id *
integer
(path)
	

Question id
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

SellerProductQuestionObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 12345,
    "body": "رنگ‌رنگ قهوه ایشو دارین‌؟",
    "date": "2023-12-21",
    "answer": {
      "id": 12345,
      "body": "سلام. بله کاملا قابل سایز می باشد. انتهای دستبند به صورت آسانسوری سایز می شود.",
      "files": [
        ""
      ],
      "status": {
        "title": "تایید شده",
        "key": "confirmed"
      },
      "date": "2023-10-08"
    },
    "answer_count": 1,
    "product": {
      "id": 12345,
      "title": "دستبند نقره مردانه",
      "link": "https://www.digikala.com/product/dkp-12345/",
      "photo": "https://dkstatics-public.digikala.com/digikala-products/bfeb186e6971e740120ea602948f763c93561f16_1.jpg"
    },
    "user": "علی موسوی"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "question_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/questions​/answer
Scopes => question

Answer to a customer question that is assigned to seller.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "question_id": 12345,
  "answer": "بله رنگ قرمز موجود هست",
  "file_ids": [
    123444
  ]
}

Responses
Code	Description	Links
200	

SellerProductQuestionObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "id": 12345,
    "body": "رنگ‌رنگ قهوه ایشو دارین‌؟",
    "date": "2023-12-21",
    "answer": {
      "id": 12345,
      "body": "سلام. بله کاملا قابل سایز می باشد. انتهای دستبند به صورت آسانسوری سایز می شود.",
      "files": [
        ""
      ],
      "status": {
        "title": "تایید شده",
        "key": "confirmed"
      },
      "date": "2023-10-08"
    },
    "answer_count": 1,
    "product": {
      "id": 12345,
      "title": "دستبند نقره مردانه",
      "link": "https://www.digikala.com/product/dkp-12345/",
      "photo": "https://dkstatics-public.digikala.com/digikala-products/bfeb186e6971e740120ea602948f763c93561f16_1.jpg"
    },
    "user": "علی موسوی"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "question_id": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Insight (5)
GET
​/open-api​/v1​/insight​/overview
Scopes => insight

Get seller's insight overview list for each day.
Parameters
Try it out
Name	Description
range *
string
(query)
	

Available values : last_7_days, last_14_days, last_30_days, before_last_14_days
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

InsightOverviewListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "charts": [
          {
            "date": "2024-08-13T00:00:00",
            "gross_sales_amount": 0,
            "gross_item_sold": 0,
            "conversion_rate": 0,
            "visit_count": 0,
            "approved_promotion_participation": 2,
            "net_item_sold_periodic_promotions": 0,
            "net_item_sold_incredible_promotions": 0,
            "net_item_sold_mega_promotions": 0,
            "net_item_sold_selling_and_sales_promotions": 0,
            "count_variants": 101,
            "count_live_variants": 0,
            "count_deactive_variants": 101,
            "count_variants_having_sales": 12,
            "net_item_sold_click_campaigns": 123
          }
        ],
        "sum": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        },
        "old_sum": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        },
        "avg": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        },
        "old_avg": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        },
        "progress": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        },
        "avg_progress": {
          "gross_sales_amount": 0,
          "gross_item_sold": 0,
          "conversion_rate": 0,
          "visit_count": 0,
          "approved_promotion_participation": 2,
          "net_item_sold_periodic_promotions": 0,
          "net_item_sold_incredible_promotions": 0,
          "net_item_sold_mega_promotions": 0,
          "net_item_sold_selling_and_sales_promotions": 0,
          "count_variants": 101,
          "count_live_variants": 0,
          "count_deactive_variants": 101,
          "count_variants_having_sales": 12,
          "net_item_sold_click_campaigns": 123
        }
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/insight​/top-deactivated
Scopes => insight

Get seller's insight overview list for each day.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

InsightTopDeactivatedListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_id": 1234,
        "category_id": 12345,
        "main_category_id": 1,
        "gross_amount": 47712600,
        "product_title": "کتاب مرگ",
        "view_count": 190,
        "impression_count": 203,
        "notification_count": 8,
        "product_image": "http://dkstatics-public.digikala.com/digikala-products/c5f1c609f156ec062047b608deee9_1658322173.jpg",
        "category_title": "کتاب شعر و ادبیات"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/insight​/trend-sales-reports
Scopes => insight

Get trend sales reports
Parameters
Try it out
Name	Description
range *
string
(query)
	

Time range of report calculation

Available values : last_7_days, last_14_days, last_30_days, before_last_14_days
category_id
integer
(query)
	

one of seller product categories
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

InsightTrendSalesReportsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "net_sales": {
          "amount": 0,
          "percentage": -100
        },
        "net_item_sold": {
          "count": 0,
          "percentage": -100
        },
        "visit_count": {
          "count": 673682,
          "percentage": -6.22
        },
        "satisfaction": {
          "amount": "Infinity",
          "percentage": "Infinity"
        },
        "order_count": {
          "count": 0,
          "percentage": -100
        },
        "net_sales_credit_method": {
          "amount": 0,
          "percentage": 0
        },
        "chart": [
          {
            "marketplace_seller_id": 12345,
            "date": "2024-08-07T00:00:00",
            "net_sales_amount": 1000,
            "net_item_sold": 1,
            "gross_sales_amount": 10000,
            "gross_item_sold": 2,
            "visit_count": 137402,
            "order_count": 12,
            "main_category_id": 1,
            "product_satisfaction_numerator": 0,
            "product_satisfaction_denominator": 0,
            "product_satisfaction_rate": 12,
            "net_sales_amount_credit_method": 12,
            "net_item_sold_credit_method": 12
          }
        ],
        "chart_avg": {
          "net_sales_amount": 1000,
          "net_item_sold": 1,
          "gross_sales_amount": 10000,
          "gross_item_sold": 2,
          "visit_count": 137402,
          "order_count": 12,
          "main_category_id": 0,
          "product_satisfaction_numerator": 0,
          "product_satisfaction_denominator": 0,
          "product_satisfaction_rate": 0,
          "net_sales_amount_credit_method": 0,
          "net_item_sold_credit_method": 0
        }
      }
    ],
    "meta_data": {
      "categories": {
        "114": "کتاب آموزش عکاسی و راهنمای دوربین",
        "150": "فیلم سینمایی"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/insight​/sales-reports
Scopes => insight

Get sales reports
Parameters
Try it out
Name	Description
range *
string
(query)
	

report time range

Available values : last_7_days, last_14_days, last_30_days, before_last_14_days
category_id
integer
(query)
	

filter based on category Id
net_item_sold_from
integer
(query)
	

filter based on net-item-sold range
net_item_sold_to
integer
(query)
	

filter based on net-item-sold range
net_sales_amount_from
float
(query)
	

filter based on net-sales-amount range
net_sales_amount_to
float
(query)
	

filter based on net-sales-amount range
search_field
string,integer
(query)
	

filter based on Product id or name
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

InsightSalesReportsListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "product_id": 1234,
        "net_sales_amount": 1000,
        "net_item_sold": 1,
        "gross_sales_amount": 10000,
        "gross_item_sold": 2,
        "visit_count": 137402,
        "order_count": 12,
        "main_category_id": 8,
        "category_id": 123,
        "conversion_rate": 12.5,
        "title": "کتاب ایکس و ایگرگ",
        "category_title": "کتاب زندگینامه",
        "image": "https://dkstatics-public.digikala.com/digikala-products/bf8580091ebb9b05ae74c40f8571a8e_1621778302.jpg?x-oss-process=image/resize,m_lfit,h_115,w_115/quality,q_60"
      }
    ],
    "meta_data": {
      "categories": {
        "114": "کتاب آموزش عکاسی و راهنمای دوربین"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/insight​/overview​/export
Scopes => insight

Export insight overview. This will send excel file download link to Seller Email address
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

InsightOverviewExcelExportForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "لینک گزارش درخواستی تا دقایقی دیگر به ایمیل ثبت شده‌ی شما ارسال می‌شود."
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Ticketing (10)
POST
​/open-api​/v1​/tickets​/{ticket_id}​/feedback
Scopes => ticketing

Submit feedback for a resolved ticket. For satisfied: rating required. For not satisfied: dissatisfaction reasons required (1-3).
Parameters
Try it out
Name	Description
ticket_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "reaction": "not_satisfied",
  "dissatisfactionReasons": [
    "slow_response",
    "irrelevant_response"
  ],
  "comment": "توضیحات بیشتر درباره نارضایتی",
  "submitAsComplaint": false
}

Responses
Code	Description	Links
200	

FeedbackForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "comment is added successfully"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "ticketId": [
      "این قسمت نباید خالی باشد"
    ],
    "reaction": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/requests
Scopes => ticketing

Get Seller Ticketing Requests
Parameters
Try it out
Name	Description
page
integer
(query)
	

Number of page.

Default value : 1
size
integer
(query)
	

List page size.

Default value : 10
sort
string
(query)
	

Define list sort column.

Available values : id

Default value : id
order
string
(query)
	

Define list sort order.

Default value : desc
search[request_id]
integer
(query)
	

Request id filter
search[sub_category_id]
integer
(query)
	

Sub category filter
search[status]
string
(query)
	

Status filter

Available values : open, in_progress, closed, on_hold, resolved
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingRequestListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "desc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 123456,
        "request_id": "C-987654",
        "title": "مشکل در ثبت سفارش",
        "category": "سفارش‌ها",
        "sub_category": "پیگیری سفارش",
        "status": "in_progress",
        "created_at": "2024-01-15T10:30:00+03:30",
        "updated_at": "2024-01-16T12:00:00+03:30",
        "is_reply_active": true,
        "has_unread_message": false,
        "provider": "crm365",
        "is_feedback_allowed": false,
        "parent_ticket_id": null,
        "is_complaint_allowed": true
      }
    ],
    "meta_data": {
      "ticket_statistics": {
        "open": 3,
        "in_progress": 3,
        "closed": 3,
        "on_hold": 3,
        "resolved": 3
      },
      "max_length_reaction_comment": 1000,
      "reactions": {
        "liked": "satisfied",
        "disliked": "not_satisfied"
      }
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/tickets​/requests
Scopes => ticketing

Create new Ticket
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "sub_category_id": 112,
  "form": {
    "title": "نام تیکت",
    "description": "توضیحات تیکت",
    "ticketing_input_123(string)": "فیلد متنی",
    "ticketing_input_3213(number)": 21,
    "ticketing_input_213(select)": [
      "opt_1",
      "opt_2",
      "opt_3"
    ],
    "ticketing_input_1212(image_ids)": [
      1231234,
      1234324
    ],
    "ticketing_input_1212(file_ids)": [
      1231234,
      1234324
    ],
    "ticketing_input_1213(drop_box)": [
      "opt_1",
      "opt_2",
      "opt_3"
    ],
    "ticketing_input_1213(dynamic_drop_box)": [
      1,
      2,
      3
    ],
    "ticketing_input_1214(dynamic_modal)": [
      {
        "product_id": 10,
        "new_reference_price": 125,
        "is_registered_in_124": true,
        "link": "link"
      }
    ]
  }
}

Responses
Code	Description	Links
200	

TicketingCreateTicketForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "request": {
      "id": 123456
    }
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "subCategoryId": [
      "این قسمت نباید خالی باشد"
    ],
    "form": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/requests​/{id}​/messages
Scopes => ticketing

Get Ticketing messages of a request. (for pricing tickets, items is a summary of products and attachments instead of messages)
Parameters
Try it out
Name	Description
id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingMessageListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "type": "seller",
        "body": "سلام، سفارش من هنوز ارسال نشده است.",
        "created_at": "2024-01-15T10:30:00+03:30",
        "attachments": [
          {
            "title": "invoice.pdf",
            "link": "https://dkstatics-public.digikala.com/marketplace-ticketing/invoice.pdf"
          }
        ]
      }
    ],
    "meta_data": {
      "ticketing_request": {
        "id": 123456,
        "request_id": "C-987654",
        "title": "مشکل در ثبت سفارش",
        "category": "سفارش‌ها",
        "sub_category": "پیگیری سفارش",
        "status": "in_progress",
        "created_at": "2024-01-15T10:30:00+03:30",
        "updated_at": "2024-01-16T12:00:00+03:30",
        "is_reply_active": true,
        "has_unread_message": false,
        "provider": "crm365",
        "is_feedback_allowed": false,
        "parent_ticket_id": null,
        "is_complaint_allowed": true
      },
      "extra_data": [
        {
          "type": "string",
          "label": "شماره سفارش",
          "value": "123456789"
        }
      ],
      "seller_logo": "https://dkstatics-public.digikala.com/digikala-seller-logo/logo.jpg",
      "body_max_length": 500,
      "max_length_reaction_comment": 1000,
      "reactions": {
        "liked": "satisfied",
        "disliked": "not_satisfied"
      },
      "require_pooling_chatbot": false,
      "show_ai_actions": false
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/tickets​/requests​/{id}​/messages
Scopes => ticketing

send Reply to Ticket
Parameters
Try it out
Name	Description
id *
(path)
	
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "body": "سلام چطوری؟ اینجا توضیح دارم مینویسم",
  "attachment_ids": [
    1231234
  ]
}

Responses
Code	Description	Links
200	

TicketingReplyTicketForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "message": "Ticket Message Created successfully"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "id": [
      "این قسمت نباید خالی باشد"
    ],
    "body": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/requests​/{ticketId}​/ai​/check
Scopes => ticketing

Check if chatbot responded to Seller Ticket or not
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingChatbotReplyMessageObjectView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "status": "pending",
    "message": "چطور میتونم کمکتون کنم؟"
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
POST
​/open-api​/v1​/tickets​/requests​/{ticketId}​/ai​/feedback
Scopes => ticketing

Define Ticket Response From Chatbot is helpful or Not
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Request body

    Example Value
    Schema

{
  "action": "assign"
}

Responses
Code	Description	Links
200	

DefineTicketStatusRepliedByChatbotForm
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "action": "assign"
  }
}

	No links
400	

Validation error! check your inputs.

    Example Value
    Schema

{
  "status": "error",
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "ticketId": [
      "این قسمت نباید خالی باشد"
    ],
    "action": [
      "این قسمت نباید خالی باشد"
    ]
  }
}

	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/categories
Scopes => ticketing

Get Ticketing Main Categories.
Parameters
Try it out
Name	Description
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingCategoryListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 50,
      "total_pages": 0,
      "total_rows": 0
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 112,
        "title": "پیگیری سفارش",
        "is_new": false,
        "hint": "برای پیگیری سفارش، شماره سفارش را وارد کنید",
        "provider": "crm365",
        "sub_categories": [
          {
            "id": 112,
            "title": "پیگیری سفارش",
            "is_new": false,
            "hint": "برای پیگیری سفارش، شماره سفارش را وارد کنید",
            "provider": "crm365"
          }
        ]
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/categories​/{category_id}​/sub-categories
Scopes => ticketing

Get Ticketing Sub Categories.
Parameters
Try it out
Name	Description
category_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingSubCategoryListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "id": 112,
        "title": "پیگیری سفارش",
        "is_new": false,
        "hint": "برای پیگیری سفارش، شماره سفارش را وارد کنید",
        "provider": "crm365"
      }
    ],
    "meta_data": {}
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
GET
​/open-api​/v1​/tickets​/sub-categories​/{sub_category_id}​/fields
Scopes => ticketing

Form Fields of a Ticketing Category.
Parameters
Try it out
Name	Description
sub_category_id *
(path)
	
content-type *
(header)
	

Default value : application/json
Responses
Code	Description	Links
200	

TicketingCategoryFieldListView
Controls Accept header.

    Example Value
    Schema

{
  "status": "ok",
  "data": {
    "sort_data": {
      "sort_column": "id",
      "sort_order": "asc",
      "sort_columns": [
        "id",
        "created_at",
        "status"
      ]
    },
    "pager": {
      "page": 1,
      "item_per_page": 10,
      "total_pages": 100,
      "total_rows": 100
    },
    "form_data": [
      null
    ],
    "items": [
      {
        "type": "string",
        "name": "ticketing_input_123",
        "label": "شماره سفارش",
        "value": null,
        "placeholder": "شماره سفارش را وارد کنید",
        "hint": "شماره سفارش در صفحه سفارش‌ها قابل مشاهده است",
        "is_required": true,
        "is_multi": false,
        "condition": {
          "field_name": "ticketing_input_122",
          "value": "opt_1",
          "operation": "eq"
        },
        "extra": {}
      }
    ],
    "meta_data": {
      "main_category": "سفارش‌ها",
      "sub_category": "پیگیری سفارش",
      "provider": "crm365"
    }
  }
}

	No links
400	

Validation error! check your inputs.
	No links
401	

Your access is denied. We can not authorize you. Please get a new access_token.!
	No links
403	

Your access is denied. Maybe you should ask a new permission!
	No links
404	

Data is not exist for your request.
	No links
429	

You reached request limit amount. try again after reset_time
	No links
500	

Server Issue. Contact with support team
	No links
Schemas
401{
status	string
example: error

response status
message	string
example: Invalid token!

error message
code	integer
example: 401

Response HTTP Status Code
}
403{
status	string
example: error

response status
message	string
example: Insufficient Scopes!

error message
code	integer
example: 403

Response HTTP Status Code
}
404{
status	string
example: error

response status
message	string
example: requested data does not exist

error message
code	integer
example: 404

Response HTTP Status Code
}
429{
status	string
example: error

response status
message	string
example: Too Many Requests from 192.168.1.1 Try again soon.

error message
code	integer
example: 429

Response HTTP Status Code
}
500{
status	string
example: error

response status
message	string
example: مشکلی در سرور وجود دارد

error message
code	integer
example: 150000001

Response HTTP Status Code
}


