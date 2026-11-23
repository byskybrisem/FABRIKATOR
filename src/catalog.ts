// Tutarlar kuruş, süreler milisaniyedir. Oyun içeriği veridir: yeni ürün, malzeme veya
// müşteri eklemek motor kodu gerektirmez.
export type MaterialId = "board" | "kit";
export type ProductId = "chair" | "table" | "shelf";

export interface Material {
  name: string;
  unit: string;
  /** Sabit liste fiyatı (kuruş/birim). Spot piyasa Paket 4'te gelir. */
  price: number;
}
export const materials: Record<MaterialId, Material> = {
  board: { name: "Tahta", unit: "adet", price: 15000 },
  kit: { name: "Bağlantı seti", unit: "set", price: 10000 },
};

export interface Recipe {
  id: ProductId;
  sector: string;
  product: string;
  /** Mobilya ürün grubu. */
  group: string;
  name: string;
  /** Kısa ad ("10 sandalye üret"). */
  short: string;
  /** "10 sandalyeyi sat" gibi belirtme hâli. */
  acc: string;
  batch: number;
  boards: number;
  kits: number;
  /** Bir partinin liste fiyatıyla malzeme tutarı. */
  materials: number;
  energy: number;
  packaging: number;
  shippingPerUnit: number;
  basePrice: number;
  /** Tek çalışan, seviye-1 makinede bir partinin süresi. */
  duration: number;
  /** Toptancının beş günlük döngüdeki günlük alım sınırı. */
  limits: number[];
  /** Açılış koşulu; yoksa baştan açıktır. */
  unlock?: { rep?: number; level?: number };
}

const recipe = (r: Omit<Recipe, "materials" | "sector">): Recipe => ({
  ...r,
  sector: "mobilya",
  materials: r.boards * materials.board.price + r.kits * materials.kit.price,
});

export const catalog: Record<ProductId, Recipe> = {
  chair: recipe({
    id: "chair",
    product: "ahsap-sandalye",
    group: "Sandalye ve masa",
    name: "Ahşap sandalye",
    short: "sandalye",
    acc: "sandalyeyi",
    batch: 10,
    boards: 20,
    kits: 10,
    energy: 30000,
    packaging: 20000,
    shippingPerUnit: 3000,
    basePrice: 85000,
    duration: 60000,
    limits: [10, 30, 24, 40, 32],
  }),
  table: recipe({
    id: "table",
    product: "yemek-masasi",
    group: "Sandalye ve masa",
    name: "Yemek masası",
    short: "masa",
    acc: "masayı",
    batch: 5,
    boards: 30,
    kits: 10,
    energy: 50000,
    packaging: 40000,
    shippingPerUnit: 9000,
    basePrice: 260000,
    duration: 120000,
    limits: [3, 6, 5, 8, 6],
    unlock: { rep: 15 },
  }),
  shelf: recipe({
    id: "shelf",
    product: "ahsap-raf",
    group: "Dolap ve raf",
    name: "Ahşap raf",
    short: "raf",
    acc: "rafı",
    batch: 8,
    boards: 24,
    kits: 16,
    energy: 40000,
    packaging: 30000,
    shippingPerUnit: 4000,
    basePrice: 135000,
    duration: 90000,
    limits: [6, 12, 10, 16, 12],
    unlock: { level: 2 },
  }),
};
export const products = Object.keys(catalog) as ProductId[];

/** Kurgusal müşteriler. `bias` fiyat eğilimi, `size` sipariş büyüklüğü eğilimidir. */
export const customers: { name: string; bias: number; size: number }[] = [
  { name: "Marmara Mobilya AŞ", bias: -0.04, size: 1 },
  { name: "Ege Ev Dekorasyon", bias: 0.06, size: 0 },
  { name: "Anadolu Ofis Donatım", bias: -0.02, size: 1 },
  { name: "Başkent Otel Grubu", bias: 0.03, size: 1 },
  { name: "Karadeniz Kafe Zinciri", bias: -0.06, size: 1 },
  { name: "Toros Okul Tedarik", bias: -0.08, size: 1 },
  { name: "Kapadokya Butik Otel", bias: 0.1, size: 0 },
  { name: "Trakya Restoran Grubu", bias: 0, size: 0 },
  { name: "Akdeniz Yapı Market", bias: -0.05, size: 1 },
  { name: "Boğaziçi Tasarım Stüdyosu", bias: 0.12, size: 0 },
  { name: "Çukurova Lokanta Birliği", bias: -0.03, size: 0 },
  { name: "Uludağ Dağ Evleri", bias: 0.05, size: 0 },
];

export type LoanKind = "isletme" | "buyume" | "leasing";
export interface LoanProduct {
  name: string;
  /** Vade: oyun günü olarak taksit sayısı. */
  days: number;
  /** Not 600'deki toplam faiz (baz puan, vade boyunca). Kredi notu bunu ölçekler. */
  rate: number;
  /** En düşük kredi tutarı (kuruş). */
  min: number;
  note: string;
}
/** Kurgusal oyun bankasının ürünleri; gerçek bankacılık hizmeti değildir. */
export const loanProducts: Record<LoanKind, LoanProduct> = {
  isletme: {
    name: "Kısa vadeli işletme kredisi",
    days: 5,
    rate: 400,
    min: 500000,
    note: "Ham madde ve maaş için kısa süreli nakit.",
  },
  buyume: {
    name: "Orta vadeli büyüme kredisi",
    days: 15,
    rate: 1500,
    min: 5000000,
    note: "Daha büyük tutar, daha uzun vade, daha yüksek toplam faiz.",
  },
  leasing: {
    name: "Makine finansmanı",
    days: 10,
    rate: 800,
    min: 0,
    note: "Yalnız makine geliştirmesinde; bedel doğrudan makineye gider.",
  },
};
