

import { Platform } from "react-native";
import { getPurchaseState, setPurchaseState } from "./storage";
import { PurchaseState } from "../types";


// development build instalado en tu celular.
export const MOCK_PURCHASES = false;

// ID de la entitlement configurada en el dashboard de RevenueCat.
export const ENTITLEMENT_ID = "full_access";

// IDs del producto "compra única / no consumible" tal como los crees en
// Google Play Console y App Store Connect (deben ser IGUALES en ambos).
export const PRODUCT_ID = "exam_full_unlock";

// API keys públicas de RevenueCat (una por plataforma). Se configuran en
// el dashboard de RevenueCat, en Project Settings > API Keys.
const REVENUECAT_API_KEYS = {
  ios: "appl_oYQmkAgsvtMJhIIoDxTqhRkkbfc",
  android: "goog_OsVbRrcQnBMJlwsrJjsFCRVhURW",
};

let configured = false;

async function getPurchasesModule() {
  // Import perezoso para que la app no truene si el módulo nativo no está
  // disponible (por ejemplo, corriendo en Expo Go).
  return await import("react-native-purchases");
}

export async function initPurchases(): Promise<void> {
  if (MOCK_PURCHASES || configured) return;
  try {
    const { default: Purchases } = await getPurchasesModule();
    const apiKey =
      Platform.OS === "ios"
        ? REVENUECAT_API_KEYS.ios
        : REVENUECAT_API_KEYS.android;
    Purchases.configure({ apiKey });
    configured = true;
  } catch (err) {
    console.warn(
      "No se pudo inicializar RevenueCat (¿estás en Expo Go?). Usa un development build.",
      err
    );
  }
}

export async function hasFullAccess(): Promise<boolean> {
  const state = await getPurchaseState();
  return state.hasFullAccess;
}

export async function purchaseFullAccess(): Promise<
  { success: true } | { success: false; error: string }
> {
  if (MOCK_PURCHASES) {
    const state: PurchaseState = {
      hasFullAccess: true,
      lastChecked: new Date().toISOString(),
    };
    await setPurchaseState(state);
    return { success: true };
  }

  try {
    const { default: Purchases } = await getPurchasesModule();
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p: any) => p.product.identifier === PRODUCT_ID
    );
    if (!pkg) {
      return {
        success: false,
        error: `No se encontró el producto ${PRODUCT_ID} en la oferta actual de RevenueCat.`,
      };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    await setPurchaseState({
      hasFullAccess: active,
      lastChecked: new Date().toISOString(),
    });
    return active
      ? { success: true }
      : { success: false, error: "La compra no activó el acceso completo." };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, error: "Compra cancelada por el usuario." };
    }
    return { success: false, error: err?.message ?? "Error desconocido en la compra." };
  }
}

export async function restorePurchases(): Promise<
  { success: true; hasFullAccess: boolean } | { success: false; error: string }
> {
  if (MOCK_PURCHASES) {
    const state = await getPurchaseState();
    return { success: true, hasFullAccess: state.hasFullAccess };
  }
  try {
    const { default: Purchases } = await getPurchasesModule();
    const customerInfo = await Purchases.restorePurchases();
    const active = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    await setPurchaseState({
      hasFullAccess: active,
      lastChecked: new Date().toISOString(),
    });
    return { success: true, hasFullAccess: active };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Error restaurando compras." };
  }
}
