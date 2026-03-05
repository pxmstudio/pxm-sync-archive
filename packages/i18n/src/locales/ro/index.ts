import type { Translations } from "../../types";
import { common } from "./common";
import { navigation } from "./navigation";
import { forms } from "./forms";
import { auth } from "./auth";
import { settings } from "./settings";
import { dashboard } from "./dashboard";
import { shop } from "./shop";
import { orders } from "./orders";
import { suppliers } from "./suppliers";
import { feeds } from "./feeds";
import { sync } from "./sync";
import { activity } from "./activity";
// Supplier-specific namespaces
import { supplierDashboard } from "./supplierDashboard";
import { products } from "./products";
import { collections } from "./collections";
import { retailers } from "./retailers";
import { pricingTiers } from "./pricingTiers";

export const ro: Translations = {
  common,
  navigation,
  forms,
  auth,
  settings,
  dashboard,
  shop,
  orders,
  suppliers,
  feeds,
  sync,
  activity,
  // Supplier-specific namespaces
  supplierDashboard,
  products,
  collections,
  retailers,
  pricingTiers,
};
