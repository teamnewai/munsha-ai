// مُلكي — العملات المتعددة (مرجع: Blueprint §1.2)
// SAR هي العملة الأساسية، والتحويل عبر RATES_PER_SAR.

export const BASE_CURRENCY = "SAR";

/** أسعار صرف تقريبية مقابل الريال (تُحدَّث من قاعدة البيانات في الإنتاج) */
export const RATES_PER_SAR: Record<string, number> = {
  SAR: 1,
  USD: 0.27,
  AED: 0.98,
  EUR: 0.25,
  GBP: 0.21,
  KWD: 0.082,
  BHD: 0.1,
  QAR: 0.97,
  OMR: 0.103,
  EGP: 13.1,
};

export const VAT_RATE = 0.15; // ضريبة القيمة المضافة — متوافق مع هيئة الزكاة والضريبة (ZATCA)

export function convertFromSAR(amountSAR: number, to: string): number {
  const rate = RATES_PER_SAR[to] ?? 1;
  return amountSAR * rate;
}

export function fmtFromSAR(amountSAR: number, currency = BASE_CURRENCY): string {
  const value = convertFromSAR(amountSAR, currency);
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function withVat(amount: number): number {
  return amount * (1 + VAT_RATE);
}
