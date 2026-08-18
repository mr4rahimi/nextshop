import axios from "axios";

const config = {
  baseURL: "https://panel.aqayepardakht.ir/api/v2",
};

const removeEmpty = (obj) => {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
};

function AqayePardakht(pin) {
  if (typeof pin !== "string") {
    throw new Error("pin is invalid");
  }
  this.pin = pin;
  axios.defaults.baseURL = config.baseURL;
}

AqayePardakht.prototype.Create = function (params) {
  const body = {
    pin: this.pin,
    amount: params.amount,
    callback: params.callback,
    card_number: params.card_number,
    invoice_id: params.invoice_id,
    mobile: params.mobile,
    email: params.email,
    description: params.description,
  };

  return axios.post("/create", removeEmpty(body));
};

AqayePardakht.prototype.Verify = function (params) {
  const body = {
    pin: this.pin,
    amount: params.amount,
    transid: params.transid,
  };

  return axios.post("/verify", removeEmpty(body));
};

export default function AqayePardakhtApi(pin) {
  return new AqayePardakht(pin);
}