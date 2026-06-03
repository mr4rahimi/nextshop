// فایل استان/شهر ایران
// برای دریافت داده کامل:
// https://github.com/shayanypn/iran-province-city/blob/master/src/cities.json
// فایل JSON رو دانلود کن و محتواش رو جایگزین PROVINCES کن

export interface City { id: number; name: string; }
export interface Province { id: number; name: string; cities: City[]; }

export const PROVINCES: Province[] = [
  { id: 1,  name: "تهران",           cities: [{ id: 1, name: "تهران" }, { id: 2, name: "کرج" }, { id: 3, name: "ری" }, { id: 4, name: "شمیرانات" }] },
  { id: 2,  name: "اصفهان",          cities: [{ id: 5, name: "اصفهان" }, { id: 6, name: "کاشان" }, { id: 7, name: "نجف‌آباد" }] },
  { id: 3,  name: "فارس",            cities: [{ id: 8, name: "شیراز" }, { id: 9, name: "مرودشت" }] },
  { id: 4,  name: "خراسان رضوی",     cities: [{ id: 10, name: "مشهد" }, { id: 11, name: "نیشابور" }, { id: 12, name: "سبزوار" }] },
  { id: 5,  name: "آذربایجان شرقی",  cities: [{ id: 13, name: "تبریز" }, { id: 14, name: "مراغه" }] },
  { id: 6,  name: "آذربایجان غربی",  cities: [{ id: 15, name: "ارومیه" }, { id: 16, name: "خوی" }] },
  { id: 7,  name: "مازندران",        cities: [{ id: 17, name: "ساری" }, { id: 18, name: "آمل" }, { id: 19, name: "بابل" }] },
  { id: 8,  name: "گیلان",           cities: [{ id: 20, name: "رشت" }, { id: 21, name: "انزلی" }] },
  { id: 9,  name: "خوزستان",         cities: [{ id: 22, name: "اهواز" }, { id: 23, name: "آبادان" }] },
  { id: 10, name: "کرمانشاه",        cities: [{ id: 24, name: "کرمانشاه" }] },
  { id: 11, name: "البرز",           cities: [{ id: 25, name: "کرج" }, { id: 26, name: "نظرآباد" }] },
  { id: 12, name: "همدان",           cities: [{ id: 27, name: "همدان" }, { id: 28, name: "ملایر" }] },
  { id: 13, name: "قم",              cities: [{ id: 29, name: "قم" }] },
  { id: 14, name: "سمنان",           cities: [{ id: 30, name: "سمنان" }, { id: 31, name: "شاهرود" }] },
  { id: 15, name: "زنجان",           cities: [{ id: 32, name: "زنجان" }] },
  { id: 16, name: "گلستان",          cities: [{ id: 33, name: "گرگان" }, { id: 34, name: "گنبد کاووس" }] },
  { id: 17, name: "خراسان شمالی",    cities: [{ id: 35, name: "بجنورد" }] },
  { id: 18, name: "خراسان جنوبی",    cities: [{ id: 36, name: "بیرجند" }] },
  { id: 19, name: "کرمان",           cities: [{ id: 37, name: "کرمان" }, { id: 38, name: "رفسنجان" }] },
  { id: 20, name: "یزد",             cities: [{ id: 39, name: "یزد" }, { id: 40, name: "میبد" }] },
  { id: 21, name: "سیستان و بلوچستان", cities: [{ id: 41, name: "زاهدان" }, { id: 42, name: "چابهار" }] },
  { id: 22, name: "هرمزگان",         cities: [{ id: 43, name: "بندرعباس" }, { id: 44, name: "قشم" }] },
  { id: 23, name: "لرستان",          cities: [{ id: 45, name: "خرم‌آباد" }, { id: 46, name: "بروجرد" }] },
  { id: 24, name: "چهارمحال و بختیاری", cities: [{ id: 47, name: "شهرکرد" }] },
  { id: 25, name: "اردبیل",          cities: [{ id: 48, name: "اردبیل" }] },
  { id: 26, name: "ایلام",           cities: [{ id: 49, name: "ایلام" }] },
  { id: 27, name: "بوشهر",           cities: [{ id: 50, name: "بوشهر" }] },
  { id: 28, name: "کهگیلویه و بویراحمد", cities: [{ id: 51, name: "یاسوج" }] },
  { id: 29, name: "مرکزی",           cities: [{ id: 52, name: "اراک" }] },
  { id: 30, name: "قزوین",           cities: [{ id: 53, name: "قزوین" }] },
  { id: 31, name: "کردستان",         cities: [{ id: 54, name: "سنندج" }] },
];
