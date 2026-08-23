export type ListingType = "trip" | "request";

export type Courier = {
  name: string;
  initials: string;
  verified: boolean;
  rating: number;
  dealsCount: number;
};

export type Listing = {
  id: string;
  type: ListingType;
  fromCity: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  freeWeightKg: number;
  pricePerKg: number;
  minPrice: number;
  currency: string;
  storageDays: number;
  courier: Courier;
};

export const cities = [
  "Нячанг",
  "Дананг",
  "Хошимин",
  "Ханой",
  "Муйне",
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Красноярск",
  "Воронеж",
  "Краснодар",
  "Ростов-на-Дону",
  "Алматы",
  "Астана",
  "Бишкек",
];

export const listings: Listing[] = [
  {
    id: "1",
    type: "trip",
    fromCity: "Москва",
    toCity: "Нячанг",
    dateFrom: "12 августа",
    dateTo: "14 августа",
    freeWeightKg: 8,
    pricePerKg: 1200,
    minPrice: 3000,
    currency: "₽",
    storageDays: 3,
    courier: { name: "Ирина К.", initials: "ИК", verified: true, rating: 4.9, dealsCount: 27 },
  },
  {
    id: "2",
    type: "trip",
    fromCity: "Санкт-Петербург",
    toCity: "Хошимин",
    dateFrom: "20 августа",
    dateTo: "21 августа",
    freeWeightKg: 5,
    pricePerKg: 1400,
    minPrice: 2500,
    currency: "₽",
    storageDays: 2,
    courier: { name: "Дмитрий В.", initials: "ДВ", verified: true, rating: 4.7, dealsCount: 14 },
  },
  {
    id: "3",
    type: "request",
    fromCity: "Алматы",
    toCity: "Дананг",
    dateFrom: "1 сентября",
    dateTo: "10 сентября",
    freeWeightKg: 2,
    pricePerKg: 1500,
    minPrice: 3000,
    currency: "₸",
    storageDays: 5,
    courier: { name: "Марина С.", initials: "МС", verified: false, rating: 5, dealsCount: 3 },
  },
  {
    id: "4",
    type: "trip",
    fromCity: "Нячанг",
    toCity: "Красноярск",
    dateFrom: "5 сентября",
    dateTo: "6 сентября",
    freeWeightKg: 10,
    pricePerKg: 1000,
    minPrice: 2000,
    currency: "₽",
    storageDays: 4,
    courier: { name: "Алексей П.", initials: "АП", verified: true, rating: 4.8, dealsCount: 41 },
  },
];

export const currentUser = {
  name: "Анна Лебедева",
  initials: "АЛ",
  city: "Нячанг",
  verified: true,
  rating: 4.9,
  dealsCount: 18,
  frequentRoutes: ["Москва → Нячанг", "Нячанг → Москва"],
  reviews: [
    { author: "Ирина К.", text: "Всё чётко, посылка доехала в срок и в целости", rating: 5 },
    { author: "Дмитрий В.", text: "На связи всю дорогу, рекомендую", rating: 5 },
    { author: "Марина С.", text: "Заранее предупредила о задержке рейса", rating: 4 },
  ],
};
