"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Bookmark, ChevronDown, ChevronUp, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { convertFromBaseCurrency, roundMoney } from "@/lib/constants/exchange-rates";
import { useCartStore } from "@/store/cart-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import type { CheckoutPayload } from "@/types/cart";
import type { AccountAddress } from "@/types/address";

type CheckoutOptionsResponse = {
  shippingMethods: Array<{
    code: string;
    name: string;
    description: string;
    baseFeeLkr: number;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  }>;
  paymentMethods: Array<{
    code: "CARD" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";
    label: string;
    enabled: boolean;
    description: string;
    unavailableReason?: string | null;
  }>;
  taxRatePercentage: number;
  cardPaymentProvider: "SANDBOX" | "STRIPE_CHECKOUT";
  cardPaymentProviderReady: boolean;
  cardPaymentProviderLabel: string;
  cardPaymentProviderUnavailableReason: string | null;
};

type CheckoutPaymentCode = "CARD" | "BANK_TRANSFER";

type AccountCheckoutSettingsResponse = {
  preferredPaymentMethod: CheckoutPaymentCode;
  preferredShippingMethodCode: string;
  updatedAt: string | null;
};

type AccountProfileResponse = {
  profile: {
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
  };
};

type CouponPreviewResponse = {
  coupon: {
    code: string;
    title: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED";
    discountScope: "ORDER" | "PRODUCT" | "CATEGORY";
  };
  totals: {
    subtotal: number;
    discountTotal: number;
    shippingFee: number;
    taxTotal: number;
    grandTotal: number;
    taxRatePercentage: number;
  };
};

const checkoutSchema = z.object({
  customerEmail: z.email("Please enter a valid email"),
  customerPhone: z.string().trim().min(7, "Please enter a valid phone number"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  line1: z.string().trim().min(1, "Address line is required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  countryCode: z.string().trim().toUpperCase().min(2).max(2),
  shippingMethodCode: z.string().trim().min(1),
  paymentMethod: z.enum(["CARD", "BANK_TRANSFER"]),
  notes: z.string().trim().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type OrderCreateResponse = {
  id: string;
  cardPayment: {
    reference: string;
    checkoutUrl: string;
    expiresAt: string;
  } | null;
};

const lastUsedAddressStorageKey = "deal-bazaar.checkout.last-address-id";
const isExternalUrl = (url: string) => /^https?:\/\//i.test(url);

export default function CheckoutPage() {
  const router = useRouter();
  const currency = useUiPreferencesStore((state) => state.currency);
  const items = useCartStore((state) => state.items);
  const selectedLineIds = useCartStore((state) => state.selectedLineIds);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const saveForLater = useCartStore((state) => state.saveForLater);
  const removeItem = useCartStore((state) => state.removeItem);
  const removeMany = useCartStore((state) => state.removeMany);
  const clearSelection = useCartStore((state) => state.clearSelection);

  const [options, setOptions] = useState<CheckoutOptionsResponse | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponPreview, setCouponPreview] = useState<CouponPreviewResponse | null>(null);
  const [appliedCouponContextKey, setAppliedCouponContextKey] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<AccountAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [hasAccountSession, setHasAccountSession] = useState(false);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>("");
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [paymentSelectionNotice, setPaymentSelectionNotice] = useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerEmail: "",
      customerPhone: "",
      firstName: "",
      lastName: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      countryCode: "LK",
      shippingMethodCode: "STANDARD",
      paymentMethod: "CARD",
      notes: "",
    },
  });

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setIsLoadingOptions(true);

      try {
        const response = await fetch("/api/checkout/options", { cache: "no-store" });
        const payload = (await response.json()) as ApiEnvelope<CheckoutOptionsResponse>;

        if (!active) return;

        if (payload.success && payload.data) {
          setOptions(payload.data);
          const availableShippingMethods = payload.data.shippingMethods;

          const enabledCheckoutPayments = payload.data.paymentMethods.filter(
            (method): method is typeof method & { code: CheckoutPaymentCode } =>
              method.enabled &&
              (method.code === "CARD" || method.code === "BANK_TRANSFER"),
          );

          let preferredPaymentMethod: CheckoutPaymentCode | null = null;
          let preferredShippingMethodCode: string | null = null;
          try {
            const settingsResponse = await fetch("/api/account/settings/checkout", {
              cache: "no-store",
            });
            if (settingsResponse.ok) {
              const settingsPayload =
                (await settingsResponse.json()) as ApiEnvelope<AccountCheckoutSettingsResponse>;
              if (settingsPayload.success && settingsPayload.data) {
                preferredPaymentMethod = settingsPayload.data.preferredPaymentMethod;
                preferredShippingMethodCode = settingsPayload.data.preferredShippingMethodCode;
              }
            }
          } catch {
            // Keep default payment selection for guest or temporary API issues.
          }

          if (availableShippingMethods.length > 0) {
            const matchedShippingMethod = availableShippingMethods.find(
              (method) => method.code === preferredShippingMethodCode,
            );
            form.setValue(
              "shippingMethodCode",
              matchedShippingMethod?.code ?? availableShippingMethods[0].code,
            );
          }

          const preferredEnabledPayment = enabledCheckoutPayments.find(
            (method) => method.code === preferredPaymentMethod,
          );
          if (preferredEnabledPayment) {
            form.setValue("paymentMethod", preferredEnabledPayment.code);
          } else if (enabledCheckoutPayments.length > 0) {
            form.setValue("paymentMethod", enabledCheckoutPayments[0].code);
          }
        }
      } catch {
        if (active) {
          setSubmitError("Unable to load checkout options. Please refresh and try again.");
        }
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    }

    loadOptions();
    return () => {
      active = false;
    };
  }, [form]);

  const applySavedAddress = useMemo(
    () => (address: AccountAddress) => {
      form.setValue("firstName", address.firstName);
      form.setValue("lastName", address.lastName);
      form.setValue("customerPhone", address.phone ?? "");
      form.setValue("line1", address.line1);
      form.setValue("line2", address.line2 ?? "");
      form.setValue("city", address.city);
      form.setValue("state", address.state ?? "");
      form.setValue("postalCode", address.postalCode ?? "");
      form.setValue("countryCode", address.countryCode);
      setSelectedSavedAddressId(address.id);
    },
    [form],
  );

  useEffect(() => {
    let active = true;

    async function loadSavedAddresses() {
      setIsLoadingAddresses(true);
      try {
        const response = await fetch("/api/account/addresses", { cache: "no-store" });

        if (!active) return;

        if (response.status === 401) {
          setHasAccountSession(false);
          setSavedAddresses([]);
          setSelectedSavedAddressId("");
          try {
            localStorage.removeItem(lastUsedAddressStorageKey);
          } catch {
            // Ignore storage access failures (private mode / blocked storage).
          }
          return;
        }

        const payload = (await response.json()) as ApiEnvelope<{ addresses: AccountAddress[] }>;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load saved addresses");
        }

        setHasAccountSession(true);
        setSavedAddresses(payload.data.addresses);

        try {
          const profileResponse = await fetch("/api/account/profile", { cache: "no-store" });
          if (profileResponse.ok) {
            const profilePayload =
              (await profileResponse.json()) as ApiEnvelope<AccountProfileResponse>;
            if (profilePayload.success && profilePayload.data?.profile) {
              const profile = profilePayload.data.profile;

              if (!form.getValues("customerEmail")) {
                form.setValue("customerEmail", profile.email);
              }
              if (!form.getValues("customerPhone")) {
                form.setValue("customerPhone", profile.phone ?? "");
              }
              if (!form.getValues("firstName")) {
                form.setValue("firstName", profile.firstName ?? "");
              }
              if (!form.getValues("lastName")) {
                form.setValue("lastName", profile.lastName ?? "");
              }
            }
          }
        } catch {
          // Keep checkout usable even if profile prefill fails.
        }

        if (payload.data.addresses.length > 0) {
          let rememberedAddressId = "";
          try {
            rememberedAddressId = localStorage.getItem(lastUsedAddressStorageKey) ?? "";
          } catch {
            // Ignore storage access failures and continue with defaults.
          }

          const defaultAddress =
            payload.data.addresses.find((address) => address.id === rememberedAddressId) ??
            payload.data.addresses.find((address) => address.isDefaultShipping) ??
            payload.data.addresses.find((address) => address.isDefaultBilling) ??
            payload.data.addresses[0];
          if (defaultAddress) {
            applySavedAddress(defaultAddress);
          }
        } else {
          setSelectedSavedAddressId("");
        }
      } catch {
        setHasAccountSession(false);
        setSavedAddresses([]);
        setSelectedSavedAddressId("");
      } finally {
        if (active) {
          setIsLoadingAddresses(false);
        }
      }
    }

    void loadSavedAddresses();

    return () => {
      active = false;
    };
  }, [applySavedAddress, form]);

  const selectedShippingCode = form.watch("shippingMethodCode");
  const selectedPaymentMethod = form.watch("paymentMethod");
  const selectedShipping = useMemo(
    () => options?.shippingMethods.find((method) => method.code === selectedShippingCode) ?? null,
    [options?.shippingMethods, selectedShippingCode],
  );
  const selectedSet = useMemo(() => new Set(selectedLineIds), [selectedLineIds]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedSet.has(item.lineId)),
    [items, selectedSet],
  );
  const enabledCheckoutPayments = useMemo(
    () =>
      (options?.paymentMethods ?? []).filter(
        (
          method,
        ): method is CheckoutOptionsResponse["paymentMethods"][number] & {
          code: CheckoutPaymentCode;
        } =>
          method.enabled && (method.code === "CARD" || method.code === "BANK_TRANSFER"),
      ),
    [options?.paymentMethods],
  );
  const hasEnabledCheckoutPayments = enabledCheckoutPayments.length > 0;
  const isSelectedPaymentMethodEnabled = enabledCheckoutPayments.some(
    (method) => method.code === selectedPaymentMethod,
  );
  const checkoutPaymentIssues = useMemo(
    () =>
      (options?.paymentMethods ?? [])
        .filter(
          (method) =>
            (method.code === "CARD" || method.code === "BANK_TRANSFER") && !method.enabled,
        )
        .map(
          (method) =>
            `${method.label}: ${method.unavailableReason ?? "Temporarily unavailable."}`,
        ),
    [options?.paymentMethods],
  );
  const cardProviderLabel =
    options?.cardPaymentProviderLabel ??
    (options?.cardPaymentProvider === "STRIPE_CHECKOUT"
      ? "Stripe Checkout"
      : "Deal Bazaar Sandbox");
  const cardProviderReady = options?.cardPaymentProviderReady ?? true;
  const cardProviderReason = options?.cardPaymentProviderUnavailableReason ?? null;
  const selectedSavedAddress =
    savedAddresses.find((address) => address.id === selectedSavedAddressId) ?? null;
  const isUsingSavedAddress = Boolean(selectedSavedAddress);

  useEffect(() => {
    if (!hasAccountSession) return;

    try {
      if (selectedSavedAddressId) {
        localStorage.setItem(lastUsedAddressStorageKey, selectedSavedAddressId);
      } else {
        localStorage.removeItem(lastUsedAddressStorageKey);
      }
    } catch {
      // Ignore storage access failures (private mode / blocked storage).
    }
  }, [hasAccountSession, selectedSavedAddressId]);

  const checkoutContextKey = useMemo(
    () =>
      JSON.stringify({
        currency,
        shippingMethodCode: selectedShippingCode,
        items: selectedItems.map((item) => `${item.lineId}:${item.quantity}`),
      }),
    [currency, selectedItems, selectedShippingCode],
  );

  useEffect(() => {
    if (!couponPreview || !appliedCouponContextKey) return;
    if (appliedCouponContextKey === checkoutContextKey) return;

    setCouponPreview(null);
    setAppliedCouponContextKey(null);
    setCouponError("Cart or shipping changed. Please apply coupon again.");
  }, [appliedCouponContextKey, checkoutContextKey, couponPreview]);

  const fallbackSubtotal = roundMoney(
    selectedItems.reduce(
      (sum, item) => sum + convertFromBaseCurrency(item.unitPriceBase, currency) * item.quantity,
      0,
    ),
    currency === "LKR" ? 0 : 2,
  );
  const fallbackShippingFee =
    selectedItems.length > 0
      ? convertFromBaseCurrency(selectedShipping?.baseFeeLkr ?? 0, currency)
      : 0;
  const fallbackTaxRate = options?.taxRatePercentage ?? 8;
  const fallbackTaxTotal = roundMoney(
    (fallbackSubtotal + fallbackShippingFee) * (fallbackTaxRate / 100),
    currency === "LKR" ? 0 : 2,
  );
  const fallbackGrandTotal = roundMoney(
    fallbackSubtotal + fallbackShippingFee + fallbackTaxTotal,
    currency === "LKR" ? 0 : 2,
  );

  const subtotal = couponPreview?.totals.subtotal ?? fallbackSubtotal;
  const discountTotal = couponPreview?.totals.discountTotal ?? 0;
  const shippingFee = couponPreview?.totals.shippingFee ?? fallbackShippingFee;
  const taxRate = couponPreview?.totals.taxRatePercentage ?? fallbackTaxRate;
  const taxTotal = couponPreview?.totals.taxTotal ?? fallbackTaxTotal;
  const grandTotal = couponPreview?.totals.grandTotal ?? fallbackGrandTotal;
  const isCheckoutDisabled =
    form.formState.isSubmitting ||
    isApplyingCoupon ||
    isLoadingOptions ||
    !hasEnabledCheckoutPayments ||
    !isSelectedPaymentMethodEnabled;
  const checkoutButtonLabel = form.formState.isSubmitting
    ? "Placing Order..."
    : selectedPaymentMethod === "CARD"
      ? "Proceed to Card Payment"
      : "Place Order";

  useEffect(() => {
    if (!options || !hasEnabledCheckoutPayments || isSelectedPaymentMethodEnabled) {
      return;
    }

    const fallbackMethod = enabledCheckoutPayments[0];
    if (!fallbackMethod) return;

    form.setValue("paymentMethod", fallbackMethod.code, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPaymentSelectionNotice(
      `Selected payment method became unavailable. Switched to ${fallbackMethod.label}.`,
    );
  }, [
    options,
    hasEnabledCheckoutPayments,
    isSelectedPaymentMethodEnabled,
    enabledCheckoutPayments,
    form,
  ]);

  async function applyCoupon() {
    setCouponError(null);
    setSubmitError(null);

    const normalizedCouponCode = couponCode.trim().toUpperCase();
    if (!normalizedCouponCode) {
      setCouponError("Enter a coupon code first.");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const response = await fetch("/api/checkout/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: normalizedCouponCode,
          shippingMethodCode: selectedShippingCode,
          currencyCode: currency,
          items: selectedItems,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<CouponPreviewResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to apply coupon");
      }

      setCouponCode(payload.data.coupon.code);
      setCouponPreview(payload.data);
      setAppliedCouponContextKey(checkoutContextKey);
    } catch (error) {
      setCouponPreview(null);
      setAppliedCouponContextKey(null);
      setCouponError(error instanceof Error ? error.message : "Unable to apply coupon");
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const normalizedCouponCode = (couponPreview?.coupon.code ?? couponCode).trim().toUpperCase();
      const payload: CheckoutPayload = {
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        notes: values.notes,
        couponCode: normalizedCouponCode.length ? normalizedCouponCode : "",
        billingAddressId: selectedSavedAddressId || null,
        shippingAddressId: selectedSavedAddressId || null,
        shippingMethodCode: values.shippingMethodCode,
        paymentMethod: values.paymentMethod,
        currencyCode: currency,
        items: selectedItems,
        billingAddress: {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.customerPhone,
          line1: values.line1,
          line2: values.line2,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          countryCode: values.countryCode,
        },
        shippingAddress: {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.customerPhone,
          line1: values.line1,
          line2: values.line2,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          countryCode: values.countryCode,
        },
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiEnvelope<OrderCreateResponse>;
      if (!response.ok || !result.success || !result.data?.id) {
        throw new Error(result.error ?? "Unable to place order");
      }

      removeMany(selectedItems.map((item) => item.lineId));
      clearSelection();

      if (result.data.cardPayment?.checkoutUrl) {
        const checkoutUrl = result.data.cardPayment.checkoutUrl;
        if (isExternalUrl(checkoutUrl)) {
          window.location.assign(checkoutUrl);
        } else {
          router.push(checkoutUrl);
        }
        return;
      }

      router.push(`/checkout/success?orderId=${encodeURIComponent(result.data.id)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to place order");
    }
  });

  if (!items.length || selectedItems.length === 0) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-2xl font-bold">No selected items to checkout</h1>
        <p className="text-sm text-muted-foreground">
          Tick the products you want from cart, then continue checkout.
        </p>
        <Button asChild>
          <Link href="/cart">Back to Cart</Link>
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
      <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold">Checkout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your details, choose shipping and payment, then place your order.
          </p>
        </header>

        {hasAccountSession ? (
          <div className="space-y-3 rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Saved Addresses</p>
              <Link href="/account/addresses" className="text-xs font-semibold text-primary hover:text-primary/80">
                Manage address book
              </Link>
            </div>

            {isLoadingAddresses ? (
              <p className="text-xs text-muted-foreground">Loading saved addresses...</p>
            ) : savedAddresses.length > 0 ? (
              <div className="space-y-2">
                <Select
                  value={selectedSavedAddressId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const nextAddress = savedAddresses.find((address) => address.id === nextId);
                    if (!nextAddress) return;
                    applySavedAddress(nextAddress);
                  }}
                >
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {(address.label ?? "Saved Address").trim()} - {address.firstName} {address.lastName} -{" "}
                      {address.city}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedSavedAddressId("")}
                  >
                    Enter New Address Manually
                  </Button>
                </div>
                {selectedSavedAddress ? (
                  <p className="text-xs text-muted-foreground">
                    Using saved address: {selectedSavedAddress.line1}, {selectedSavedAddress.city},{" "}
                    {selectedSavedAddress.countryCode}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No saved addresses found. Add one from your account to use one-click checkout addresses.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-semibold">First Name</label>
            <Input {...form.register("firstName")} disabled={isUsingSavedAddress} />
            {form.formState.errors.firstName ? (
              <p className="text-xs text-red-600">{form.formState.errors.firstName.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Last Name</label>
            <Input {...form.register("lastName")} disabled={isUsingSavedAddress} />
            {form.formState.errors.lastName ? (
              <p className="text-xs text-red-600">{form.formState.errors.lastName.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Email</label>
            <Input type="email" {...form.register("customerEmail")} />
            {form.formState.errors.customerEmail ? (
              <p className="text-xs text-red-600">{form.formState.errors.customerEmail.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Phone</label>
            <Input {...form.register("customerPhone")} disabled={isUsingSavedAddress} />
            {form.formState.errors.customerPhone ? (
              <p className="text-xs text-red-600">{form.formState.errors.customerPhone.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Address Line 1</label>
          <Input {...form.register("line1")} disabled={isUsingSavedAddress} />
          {form.formState.errors.line1 ? (
            <p className="text-xs text-red-600">{form.formState.errors.line1.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Address Line 2 (Optional)</label>
          <Input {...form.register("line2")} disabled={isUsingSavedAddress} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold">City</label>
            <Input {...form.register("city")} disabled={isUsingSavedAddress} />
            {form.formState.errors.city ? (
              <p className="text-xs text-red-600">{form.formState.errors.city.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">State/Province</label>
            <Input {...form.register("state")} disabled={isUsingSavedAddress} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">Postal Code</label>
            <Input {...form.register("postalCode")} disabled={isUsingSavedAddress} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-semibold">Country Code</label>
            <Input maxLength={2} {...form.register("countryCode")} disabled={isUsingSavedAddress} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">Shipping Method</label>
            <Select {...form.register("shippingMethodCode")} disabled={isLoadingOptions}>
              {(options?.shippingMethods ?? []).map((method) => (
                <option key={method.code} value={method.code}>
                  {method.name} ({method.estimatedDaysMin}-{method.estimatedDaysMax} days)
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Payment Method</p>
          {paymentSelectionNotice ? (
            <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              {paymentSelectionNotice}
            </p>
          ) : null}
          <div
            className={
              cardProviderReady
                ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs"
                : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
            }
          >
            <p
              className={
                cardProviderReady
                  ? "font-semibold text-emerald-700 dark:text-emerald-300"
                  : "font-semibold text-amber-700 dark:text-amber-300"
              }
            >
              Card Gateway: {cardProviderLabel} {cardProviderReady ? "(Ready)" : "(Needs setup)"}
            </p>
            {!cardProviderReady && cardProviderReason ? (
              <p className="mt-1 text-amber-700 dark:text-amber-300">{cardProviderReason}</p>
            ) : null}
          </div>
          {!hasEnabledCheckoutPayments ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Card and bank transfer are temporarily unavailable. Please try again later.
            </p>
          ) : null}
          {!hasEnabledCheckoutPayments && checkoutPaymentIssues.length > 0 ? (
            <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {checkoutPaymentIssues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          ) : null}
          {hasEnabledCheckoutPayments && !isSelectedPaymentMethodEnabled ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Current payment selection is unavailable. Please choose another method.
            </p>
          ) : null}
          {(options?.paymentMethods ?? []).map((method) => (
            <label
              key={method.code}
              className={`flex items-start gap-3 rounded-xl border border-border bg-background p-3 ${
                method.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-85"
              }`}
            >
              <input
                type="radio"
                value={method.code}
                disabled={!method.enabled || method.code === "CASH_ON_DELIVERY"}
                {...form.register("paymentMethod")}
                className="mt-1"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {method.label}
                  {!method.enabled ? (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Unavailable
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {method.enabled
                    ? method.description
                    : method.unavailableReason ?? method.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">Order Notes (Optional)</label>
          <textarea
            rows={3}
            {...form.register("notes")}
            className="focus-ring w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground"
            placeholder="Add any delivery notes..."
          />
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Order Summary</h2>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Selected products</span>
          <span>{selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}</span>
        </div>
        <div className="space-y-2">
          {selectedItems.map((item) => {
            const unitPrice = convertFromBaseCurrency(item.unitPriceBase, currency);
            return (
              <div key={item.lineId} className="flex gap-2 rounded-lg border border-border bg-background p-2">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-semibold">{item.name}</p>
                  <div className="mt-1 inline-flex items-center rounded-md border border-border">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-none"
                      onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="px-2 text-[11px] font-semibold">{item.quantity}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-none"
                      onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs font-bold text-primary">
                    {formatCurrency(unitPrice * item.quantity, currency)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => saveForLater(item.lineId)}
                    aria-label={`Save ${item.name} for later`}
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => removeItem(item.lineId)}
                    aria-label={`Remove ${item.name} from checkout`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-semibold">Coupon Code</p>
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="Enter coupon"
              className="h-10"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={isApplyingCoupon}
              onClick={() => void applyCoupon()}
            >
              {isApplyingCoupon ? "Applying..." : "Apply"}
            </Button>
          </div>
          {couponPreview ? (
            <div className="space-y-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-2 text-xs">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                {couponPreview.coupon.code} applied
              </p>
              <p className="text-muted-foreground">
                {couponPreview.coupon.title}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setCouponPreview(null);
                  setAppliedCouponContextKey(null);
                  setCouponError(null);
                }}
              >
                Remove coupon
              </Button>
            </div>
          ) : null}
          {couponError ? <p className="text-xs text-red-600">{couponError}</p> : null}
        </div>

        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className={discountTotal > 0 ? "font-semibold text-emerald-600" : ""}>
              -{formatCurrency(discountTotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatCurrency(shippingFee, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span>{formatCurrency(taxTotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isCheckoutDisabled}
        >
          {checkoutButtonLabel}
        </Button>
        <Button type="button" variant="outline" className="w-full" asChild>
          <Link href="/cart">Back to Cart</Link>
        </Button>
      </aside>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="container-app space-y-2 py-2">
          <button
            type="button"
            onClick={() => setIsMobileSummaryOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left"
          >
            <span>
              <span className="block text-xs text-muted-foreground">
                {selectedItems.length} selected item{selectedItems.length === 1 ? "" : "s"}
              </span>
              <span className="text-sm font-semibold">{formatCurrency(grandTotal, currency)}</span>
            </span>
            {isMobileSummaryOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {isMobileSummaryOpen ? (
            <div className="space-y-1 rounded-lg border border-border bg-background p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className={discountTotal > 0 ? "font-semibold text-emerald-600" : ""}>
                  -{formatCurrency(discountTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatCurrency(shippingFee, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxTotal, currency)}</span>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" className="flex-1" disabled={isCheckoutDisabled}>
              {checkoutButtonLabel}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/cart">Cart</Link>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
