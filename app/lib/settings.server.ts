import { Settings } from "@prisma/client";
import prisma from "app/db.server";

export const METAFIELD_NAMESPACE = "fsb";
export const METAFIELD_KEY = "settings";

const HEX = /^#[0-9a-f]{6}$/i;

export type SettingsInput = Omit<Settings, "id" | "shop" | "createdAt" | "updatedAt">;

/** Loads settings, creating defaults (and publishing them) on first visit. */
export async function getSettings(shop: string, graphql: AdminGraphql) {
  const existing = await prisma.settings.findUnique({ where: { shop } });
  if (existing) return existing;
  const created = await prisma.settings.create({ data: { shop } });
  await syncSettingsMetafield(graphql, created);
  return created;
}

/** Parses and validates form data. Returns either the input or field errors. */
export function parseSettingsForm(form: FormData):
  | { ok: true; data: SettingsInput }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const bool = (k: string) => form.get(k) === "true" || form.get(k) === "on";
  const int = (k: string, min: number, max: number) => {
    const n = Number(str(k));
    if (!Number.isFinite(n) || n < min || n > max) {
      errors[k] = `Must be between ${min} and ${max}`;
      return min;
    }
    return Math.round(n);
  };
  const color = (k: string) => {
    const v = str(k);
    if (!HEX.test(v)) errors[k] = "Use a hex color like #008060";
    return v;
  };
  const text = (k: string) => {
    const v = str(k);
    if (!v) errors[k] = "Required";
    if (v.length > 200) errors[k] = "Max 200 characters";
    return v;
  };

  const threshold = Number(str("threshold"));
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1_000_000) {
    errors.threshold = "Enter an amount greater than 0";
  }
  const drawerPosition = str("drawerPosition") === "bottom" ? "bottom" : "top";

  const data: SettingsInput = {
    enabled: bool("enabled"),
    thresholdCents: Math.round(threshold * 100),
    messageEmpty: text("messageEmpty"),
    messageProgress: text("messageProgress"),
    messageSuccess: text("messageSuccess"),
    barColor: color("barColor"),
    trackColor: color("trackColor"),
    backgroundColor: color("backgroundColor"),
    textColor: color("textColor"),
    fontSize: int("fontSize", 10, 24),
    borderRadius: int("borderRadius", 0, 24),
    showOnCartPage: bool("showOnCartPage"),
    showInDrawer: bool("showInDrawer"),
    drawerPosition,
    drawerSelector: str("drawerSelector").slice(0, 200),
  };

  if (!data.messageProgress.includes("{amount}")) {
    errors.messageProgress ??= "Must include {amount}";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}


/** Shape read by the theme extension via app.metafields.fsb.settings. */
export function toStorefrontConfig(s: SettingsInput) {
  return {
    enabled: s.enabled,
    thresholdCents: s.thresholdCents,
    messages: {
      empty: s.messageEmpty,
      progress: s.messageProgress,
      success: s.messageSuccess,
    },
    style: {
      barColor: s.barColor,
      trackColor: s.trackColor,
      backgroundColor: s.backgroundColor,
      textColor: s.textColor,
      fontSize: s.fontSize,
      borderRadius: s.borderRadius,
    },
    placement: {
      cartPage: s.showOnCartPage,
      drawer: s.showInDrawer,
      drawerPosition: s.drawerPosition,
      drawerSelector: s.drawerSelector,
    },
  };
}

type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

/** Mirrors settings to an app-data metafield on the current app installation. */
export async function syncSettingsMetafield(graphql: AdminGraphql, s: SettingsInput) {
  const idRes = await graphql(`#graphql
    query FsbAppInstallation { currentAppInstallation { id } }`);
  const idJson = await idRes.json();
  const ownerId = idJson.data?.currentAppInstallation?.id;
  if (!ownerId) throw new Error("Could not resolve app installation");

  const res = await graphql(
    `#graphql
    mutation FsbSetSettings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(toStorefrontConfig(s)),
          },
        ],
      },
    },
  );
  const json = await res.json();
  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }
}

export async function saveSettings(
  shop: string,
  graphql: AdminGraphql,
  data: SettingsInput,
) {
  const saved = await prisma.settings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
  await syncSettingsMetafield(graphql, data);
  return saved;
}
