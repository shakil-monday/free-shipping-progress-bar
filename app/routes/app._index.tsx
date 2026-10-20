import {
  useLoaderData,
  type ActionFunctionArgs,
  type HeadersFunction,
  type LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { FormEvent, useState } from "react";
import ProgressPreview, { PreviewSettings } from "app/components/ProgressPreview";
import { getSettings } from "app/lib/settings.server";

const EMBED_HANDLE = "app-embed";
const BLOCK_HANDLE = "cart-progress";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getSettings(session.shop, admin.graphql);

  const res = await admin.graphql(`#graphql
    query FsbShop { shop { currencyCode } }`);
  const json = await res.json();

  // const settings = {
  //   enabled: true,
  //   thresholdCents: 500000,
  //   threshold: "5000",
  //   messageEmpty: "Free shipping on orders over {threshold}",
  //   messageProgress: "Add {amount} more for free shipping",
  //   messageSuccess: "Congrats! You've unlocked free shipping 🎉",
  //   barColor: "#008060",
  //   trackColor: "#e3e3e3",
  //   backgroundColor: "#f6f6f7",
  //   textColor: "#202223",
  //   fontSize: 14,
  //   borderRadius: 8,
  //   showOnCartPage: true,
  //   showInDrawer: true,
  //   drawerPosition: "top",
  //   drawerSelector: "",
  // }

  return {
    settings: settings,
    currency: (json.data?.shop?.currencyCode as String) ?? "USD",
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

type LoaderSettings = ReturnType<typeof useLoaderData<typeof loader>>["settings"];

function toPreview(s: LoaderSettings): PreviewSettings {
  return { ...s, threshold: (s.thresholdCents / 100).toFixed(2) };
}


function readForm(form: HTMLFormElement, prev: PreviewSettings): PreviewSettings {
  const fd = new FormData(form);

  const str = (k: keyof PreviewSettings) => String(fd.get(k) ?? prev[k]);
  console.log("fd threshold: ", str("threshold"));

  return {
    ...prev,
    threshold: str("threshold"),
    messageEmpty: str("messageEmpty"),
    messageProgress: str("messageProgress"),
    messageSuccess: str("messageSuccess"),
    barColor: str("barColor"),
    trackColor: str("trackColor"),
    backgroundColor: str("backgroundColor"),
    textColor: str("textColor"),
    fontSize: Number(str("fontSize")) || prev.fontSize,
    borderRadius: Number(str("borderRadius")),
  };
}

export default function Index() {
  const { settings, shop, apiKey, currency } = useLoaderData<typeof loader>();
  const [preview, setPreview] = useState(() => toPreview(settings));
  const [previewCart, setPreviewCart] = useState(() => (settings.thresholdCents * 0.6 / 100).toFixed(2))

  const storeHandle = shop.replace(".myshopify.com", "");
  const editorBase = `https://admin.shopify.com/store/${storeHandle}/themes/current/editor`;
  const embedLink = `${editorBase}?context=apps&activateAppId=${apiKey}/${EMBED_HANDLE}`;
  const blockLink = `${editorBase}?template=cart&addAppBlockId=${apiKey}/${BLOCK_HANDLE}&target=newAppsSection`;

  var handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    var formData = new FormData(e.currentTarget);
    var messageEmpty = formData.get("messageEmpty");
  }

  return (
    <s-page heading="Free Shipping Progress Bar">
      <s-button slot="primary-action">
        Save
      </s-button>

      <form
        onInput={(e) => {
          const form = e.currentTarget;
          setPreview((p) => readForm(form, p));
        }}
        onChange={(e) => {
          const form = e.currentTarget;
          setPreview((p) => readForm(form, p));
        }}
        onSubmit={(e) => {
          const form = e.currentTarget;
          setPreview((p) => readForm(form, p));
        }}
      >
        <s-stack direction="block" gap="base">
          <s-section heading="Preview">
            <s-stack direction="block" gap="base">
              <ProgressPreview
                settings={preview}
                cartCents={Math.round(Number(previewCart || 0) * 100)}
                currency={String(currency)}
              />
              <s-money-field
                label="Sample cart total (preview only)"
                value={previewCart}
                onInput={(e) => {
                  e.stopPropagation();
                  setPreviewCart(e.currentTarget.value);
                }}
              />
            </s-stack>
          </s-section>

          <s-section heading="Threshold">
            <s-stack direction="block" gap="base">
              <s-switch
                label="Show the progress bar on my store"
                name="enabled"
                value="true"
                defaultChecked={settings.enabled}
              />
              <s-money-field
                label={`Free shipping threshold (${currency})`}
                name="threshold"
                defaultValue={(settings.thresholdCents / 100).toFixed(2)}
                details="Set this to match your free-shipping rate. Shoppers in other currencies see it converted automatically."
              // {...err("threshold")}
              />
            </s-stack>
          </s-section>

          <s-section heading="Messages">
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Empty cart"
                name="messageEmpty"
                details="Use {threshold} for the threshold amount."
                defaultValue={settings.messageEmpty}
              />
              <s-text-field
                label="In progress"
                name="messageProgress"
                details="Use {amount} for the remaining amount, e.g. “Add {amount} more for free shipping”."
                defaultValue={settings.messageProgress}
              />
              <s-text-field
                label="Goal reached"
                name="messageSuccess"
                defaultValue={settings.messageSuccess}
              />
            </s-stack>
          </s-section>

          <s-section heading="Style">
            <s-stack direction="block" gap="base">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-color-field
                  label="Bar color"
                  name="barColor"
                  defaultValue={settings.barColor}
                />
                <s-color-field
                  label="Track color"
                  name="trackColor"
                  defaultValue={settings.trackColor}
                />
                <s-color-field
                  label="Background"
                  name="backgroundColor"
                  defaultValue={settings.backgroundColor}
                />
                <s-color-field
                  label="Text color"
                  name="textColor"
                  defaultValue={settings.textColor}
                />
                <s-number-field
                  label="Font size (px)"
                  name="fontSize"
                  min={10}
                  max={24}
                  defaultValue={String(settings.fontSize)}
                />
                <s-number-field
                  label="Corner radius (px)"
                  name="borderRadius"
                  min={0}
                  max={24}
                  defaultValue={String(settings.borderRadius)}
                />
              </s-grid>
            </s-stack>
          </s-section>

          <s-section heading="Placement">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Cart page"
                name="showOnCartPage"
                value="true"
                defaultChecked={settings.showOnCartPage}
                details="Requires the “Free shipping bar” block on your cart template."
              />
              <s-checkbox
                label="Cart drawer"
                name="showInDrawer"
                value="true"
                defaultChecked={settings.showInDrawer}
                details="Requires the app embed to be turned on."
              />
              <s-select
                label="Position in cart drawer"
                name="drawerPosition"
                value={settings.drawerPosition}
              >
                <s-option value="top">Top</s-option>
                <s-option value="bottom">Bottom (above checkout)</s-option>
              </s-select>
              <s-text-field
                label="Custom cart drawer selector (advanced)"
                name="drawerSelector"
                placeholder="#CartDrawer .drawer__inner"
                details="Leave this blank to detect it automatically. Fill it in only if the bar doesn't appear in your theme's drawer."
              />
            </s-stack>
          </s-section>

        </s-stack>
      </form>

      <s-section slot="aside" heading="Set up your theme">
        <s-stack direction="block" gap="base">
          <s-paragraph>1. Turn on the app embed. It loads the bar and powers the cart drawer.</s-paragraph>
          <s-button href={embedLink} target="_blank">Enable app embed</s-button>
          <s-paragraph>2. Add the block to your cart page.</s-paragraph>
          <s-button href={blockLink} target="_blank">Add cart page block</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
