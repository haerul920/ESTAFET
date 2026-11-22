"use client";

import { useState } from "react";
import Script from "next/script";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * The visitor side of the bot check (`src/lib/botcheck.ts`): a hidden honeypot field and, when a site key is
 * configured, the Cloudflare Turnstile widget. Put it inside a `<form>`; pass the form data through `withFillTime`.
 */
export function BotFields() {
  return (
    <>
      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {TURNSTILE_SITE_KEY ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
        </>
      ) : null}
    </>
  );
}

/**
 * Measures how long the form was open. The browser sends the elapsed time (`fill_ms`), so a wrong clock does not matter.
 * Call `stamp(formData)` just before sending.
 */
export function useFillTimer(): (formData: FormData) => FormData {
  const [openedAt] = useState(() => Date.now());
  return (formData) => {
    formData.set("fill_ms", String(Date.now() - openedAt));
    return formData;
  };
}
