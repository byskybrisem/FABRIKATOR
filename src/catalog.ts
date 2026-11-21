// Tutarlar kuruş, süreler milisaniyedir. Yalnız oynanabilir tarifler kataloğa girer.
export interface Recipe {
  sector: string;
  product: string;
  name: string;
  batch: number;
  boards: number;
  kits: number;
  materials: number;
  energy: number;
  packaging: number;
  shippingPerUnit: number;
  basePrice: number;
  duration: number;
}
export const catalog = {
  chair: {
    sector: "mobilya",
    product: "ahsap-sandalye",
    name: "Ahşap sandalye",
    batch: 10,
    boards: 20,
    kits: 10,
    materials: 400000,
    energy: 30000,
    packaging: 20000,
    shippingPerUnit: 3000,
    basePrice: 85000,
    duration: 60000,
  },
} satisfies Record<string, Recipe>;
