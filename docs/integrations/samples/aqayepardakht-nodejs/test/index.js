import AqayePardakht from "../lib/aqayepardakht.js";

const aqayepardakht = AqayePardakht("aqayepardakht");

aqayepardakht
  .Create({ amount: 1000, callback: "https://test.com" })
  .then((response) => {
    console.log(response.data);
  })
  .catch((err) => {
    console.error(err.response.data);
  });

aqayepardakht
  .Verify({ amount: 1000, transid: "123" })
  .then((response) => {
    console.log(response.data);
  })
  .catch((err) => {
    console.error(err.response.data);
  });
