import type { CurrencyCode } from "@/lib/constants/currency";

export type ShippingMethodOption = {
  code: string;
  name: string;
  description: string;
  baseFeeLkr: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
};

export type PaymentOption = {
  code: "CARD" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";
  label: string;
  enabled: boolean;
  description: string;
  unavailableReason?: string | null;
};

export type BankTransferDetails = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  swiftCode: string;
  note: string;
};

export const defaultShippingMethods: ShippingMethodOption[] = [
  {
    code: "STANDARD",
    name: "Standard Delivery",
    description: "Reliable local and international delivery where available.",
    baseFeeLkr: 450,
    estimatedDaysMin: 2,
    estimatedDaysMax: 5,
  },
  {
    code: "EXPRESS",
    name: "Express Delivery",
    description: "Priority processing for faster delivery in supported locations.",
    baseFeeLkr: 950,
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
  },
  {
    code: "PICKUP",
    name: "Store Pickup",
    description: "Collect from selected pickup points.",
    baseFeeLkr: 0,
    estimatedDaysMin: 0,
    estimatedDaysMax: 1,
  },
];

export const defaultPaymentOptions: PaymentOption[] = [
  {
    code: "CARD",
    label: "Card Payment",
    enabled: true,
    description: "Pay securely using debit or credit cards.",
  },
  {
    code: "BANK_TRANSFER",
    label: "Bank Transfer",
    enabled: true,
    description: "Transfer to our bank account and upload payment proof.",
  },
  {
    code: "CASH_ON_DELIVERY",
    label: "Cash on Delivery",
    enabled: false,
    description: "Coming soon.",
  },
];

export const defaultBankTransferDetails: BankTransferDetails = {
  accountName: "Deal Bazaar Pvt Ltd",
  bankName: "Bank of Ceylon",
  accountNumber: "7654321098",
  branch: "Colombo Main Branch",
  swiftCode: "BCEYLKLX",
  note: "Use your order number as the payment reference.",
};

export const defaultTaxRatePercentage = 8;
export const defaultOrderCurrency: CurrencyCode = "LKR";
