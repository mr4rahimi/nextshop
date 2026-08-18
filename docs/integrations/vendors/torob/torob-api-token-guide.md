راهنمای توکن API ترب

تمامی درخواست‌هایی که به درگاه TorobAPI ارسال می‌شوند شامل یک JWT token در هدر X-Torob-Token می‌باشند. فروشگاه‌ها با اعتبارسنجی این توکن می‌توانند مطمئن شوند که درخواست از سمت ترب ارسال شده است و از دسترسی افراد غیرمجاز به اطلاعات داخل api جلوگیری کنند.

توکن ارسال شده با استفاده از کلید خصوصی ترب امضا شده است و فروشگاه‌ها می‌توانند با استفاده کلید عمومی ترب که در زیر آمده است، توکن را اعتبارسنجی کنند. نحوه‌ی اعتبارسنجی توکن ترب با زیان‌های مختلف به عنوان نمونه در انتها آورده شده است.
کلید عمومی ترب

کلید عمومی ترب برای اعتبارسنجی توکن‌های ارسالی به فروشگاه‌ها به شکل زیر است: برای اعتبارسنجی توکن باید از الگوریتم EdDSA(ed25519) استفاده شود.

-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----

نمونه‌ی درخواست به همراه توکن

نمونه‌ی درخواست ارسالی همراه با توکن در زیر آمده است:

curl --header "Content-Type: application/json" \
     --header "Accept: application/json" \
     --header "X-Torob-Token: [jwt_token]" \
     --header "X-Torob-Token-Version: 1" \
     --request POST \
     --data '{"page": 1}' \
     'https://example.com/torob_api/v3/products'

نحوه‌ی اعتبارسنجی توکن

محتوای header و payload موجود در توکن ارسالی به صورت زیر است.

{
  "header": {"alg": "EdDSA", "typ": "JWT", "v": 1},
  "payload": {"aud": "api.example.com", "exp": 1730206744, "nbf":  1730206000}
}

در قسمت payload سه کلید بسیار مهم وجود دارند: مقدار exp زمان منقضی شدن توکن به فرمت unix epoch را نشان می‌دهد و واحد آن ثانیه می‌باشد. بعد از این زمان توکن باید غیرمعتبر در نظر گرفته شود. مقدار nbf زمانی که توکن قبل از آن valid نیست را نشان میدهد و واحد آن نیر ثانیه می‌باشد.

مقدار aud برابر با هدر Host در درخواست ارسالی می‌باشد و معمولا برابر با دامنه‌ای است که این توکن برای آن تولید شده است. برای نمونه مقادیر مختلف aud به ازای آدرس‌های مختلف به صورت زیر است:

https://example.com/torob_api/v3/  --> aud: example.com
https://api.example.com/v3/  --> aud: api.example.com
https://api.example.com:8080/v3/  --> aud: api.example.com:8080

پس از اعتبارسنجی و decode کردن توکن ارسال شده از طرف ترب، حتما باید مقدار فیلد aud با آدرس فعلی api چک شود و این دو باهم برابر باشند. انجام این کار برای این است که مطمئن شویم توکن تولید شده فقط برای همان فروشگاه بوده و توکن تولید شده برای دیگر فروشگاه‌ها برای فروشگاه شما معتبر نباشد.

در بسیاری از کتابخانه‌ها مقدار این دو فیلد به صورت خودکار بررسی می‌شود اما لازم است حتما در هنگام پیاده‌سازی از چک شدن این دو فیلد توسط کتابخانه استفاده شده اطمینان حاصل کنید و در صورت لزوم به صورت دستی آن‌را پیاده‌سازی کنید.

لطفا توجه کنید که درست بودن زمان سرور بسیار مهم است و اگر زمان سرور درست تنظیم نشده باشد ممکن است توکن‌های ارسالی از طرف ترب غیرمعتبر در نظر گرفته شوند.
نمونه‌ی اعتبارسنجی توکن ترب با زبان Python

برای اعتبارسنجی و decode کردن توکن ارسالی از طرف ترب می‌توان از کتابخونه‌ی pyjwt[crypto] استفاده کرد.

import jwt

PUBLIC_KEY = f"""
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----
"""

def validate_token(token: str):
    # exp and aud fields are checked by PyJWT library.
    jwt.decode(token, key=PUBLIC_KEY, algorithms=["EdDSA"], audience="[expected_aud_value]")

نمونه‌ی اعتبارسنجی توکن ترب با زبان گولنگ

package main

import (
	"crypto"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"log"
)

func verify(token string, parser *jwt.Parser, key crypto.PublicKey) (*jwt.Token, error) {
	parsedToken, err := parser.ParseWithClaims(token, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
		return key, nil
	})
	if err != nil {
		return nil, fmt.Errorf("unable to parse token: %v", err)
	}
	return parsedToken, nil
}

func main() {
	publicKey := []byte(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEApRa/occuX1AyPs7Hl21jiWuDzr7vl6jgipR3RSDChMw=
-----END PUBLIC KEY-----`)
	publicKeyPem, err := jwt.ParseEdPublicKeyFromPEM(publicKey)
	if err != nil {
		log.Fatal(err)
	}
	// aud and exp fields are checked by jwt library
	parser := jwt.NewParser(jwt.WithAudience("[expected_aud_value]"), jwt.WithExpirationRequired(), jwt.WithValidMethods([]string{"EdDSA"}))
	// parser and publicKeyPem are constant and should be computed only once in your code.
    // token is the JWT token received from the client.
	token := "..."

	if _, err = verify(token, parser, publicKeyPem); err != nil {
		log.Fatal(err)
	}
}

نمونه‌ی اعتبارسنجی توکن ترب با زبان Java

برای اعتبار سنجی با زبان جاوا می‌توان از کتابخانه‌ی روبرو استفاده نمود: https://github.com/jwtk/jjwt

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import java.security.*;
import java.security.spec.*;


public class JwtVerifier {
    private final JwtParser parser;

    public JwtVerifier() throws NoSuchAlgorithmException, InvalidKeySpecException {
        final var publicKeyString = "MCowBQYDK2VwAyEA17m5ndg5lFvtbyxxzWgA4up1NCBCFeGbUCbQY3vhe2M=";
        KeySpec keySpec = new X509EncodedKeySpec(Decoders.BASE64.decode(publicKeyString));
        PublicKey publicKey = KeyFactory.getInstance("EdDSA").generatePublic(keySpec);
        // aud and exp fields are checked by library.
        parser = Jwts.parser().requireAudience("[expected_aud_value]").verifyWith(publicKey).build();
    }

    public Jws<Claims> verifyToken(String token) {
        return parser.parseSignedClaims(token);
    }
}

نمونه‌ی اعتبارسنجی توکن ترب با زبان PHP

برای اعتبار سنجی با زبان PHP می‌توان از کتابخانه‌ی firebase/php-jwt استفاده نمود:

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

define('TOROB_PUBLIC_KEY','MCowBQYDK2VwAyEAWBtp4vMYs8HAyyDY92z7FKYcH43Qjczz3ZMg1cxVRjc=');
define('TOROB_PUBLIC_KEY_SEED',base64_encode(substr(base64_decode(TOROB_PUBLIC_KEY), -32)));

function verify($jwt): object {
    // exp is checked by library but we should check aud manually.
    $decoded = JWT::decode($jwt, new Key(TOROB_PUBLIC_KEY_SEED, 'EdDSA'));
    if ($decoded->aud !== "[expected_aud_value]") {
        throw new \Exception("Invalid audience");
    }
    return $decoded;
}

