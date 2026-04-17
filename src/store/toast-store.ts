"use client";

import { create } from "zustand";

export type ToastItem = {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
};

type ToastState = {
  toasts: ToastItem[];
  pushToast: (message: string, tone?: ToastItem["tone"]) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

function createToastId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (message, tone = "success") =>
    set((state) => ({
      toasts: [...state.toasts, { id: createToastId(), message, tone }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));
