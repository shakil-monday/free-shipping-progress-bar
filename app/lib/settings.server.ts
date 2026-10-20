import { Settings } from "@prisma/client";
import prisma from "app/db.server";

export const METAFIELD_NAMESPACE = "fsb";
export const METAFIELD_KEY = "settings";

export type SettingsInput = Omit<Settings, "id" | "shop" | "createdAt" | "updatedAt">;

/** Loads settings, creating defaults (and publishing them) on first visit. */
export async function getSettings(shop: string, graphql: AdminGraphql) {
  const existing = await prisma.settings.findUnique({ where: { shop } });
  console.log("shop: ", shop);
  if (existing) return existing;
  const created = await prisma.settings.create({ data: { shop } });
  await syncSettingsMetafield(graphql, created);
  return created;
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