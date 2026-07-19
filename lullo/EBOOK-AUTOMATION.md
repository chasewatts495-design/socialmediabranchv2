# Calm-Trim Guide — Automatic Delivery Setup (Shopify-native, no paid apps)

The eBook (`lullo/ebook/calm-trim-guide.pdf`) is delivered automatically two ways:
1. **Every order** → delivery email with the download link (Shopify Flow)
2. **Email signup** (lead-magnet popup) → same email (Shopify Forms + Shopify Email)

All steps below happen in the Shopify admin. ~30 minutes total.

---

## Step 1 — Host the PDF

1. Shopify admin → **Content → Files** → **Upload files** → upload `calm-trim-guide.pdf`.
2. Click the copy-link icon next to the uploaded file. You now have a CDN URL like
   `https://cdn.shopify.com/s/files/.../calm-trim-guide.pdf`.
3. Save this URL — it's used in both emails and the popup below. (Re-uploading a new version later gives a new URL; update the emails when you do.)

## Step 2 — Order path (Shopify Flow)

1. Admin → **Apps → Shopify Flow** (install free from the Shopify App Store if not present).
2. **Create workflow** → Trigger: **Order created**.
3. (Optional condition: only when the order contains CalmPaw Plus — Condition → "Order line items product title" contains "CalmPaw". With a one-product store you can skip this.)
4. Action: **Send internal email** is NOT what we want — choose the **"Send marketing email"**/customer-email action if available on your plan; if Flow on your plan can only email staff, use this fallback instead:
   - **Fallback (works on every plan):** put the download link in the **order confirmation email**. Admin → **Settings → Notifications → Customer notifications → Order confirmation** → edit, and paste the HTML block below just after the order summary. Every buyer gets it instantly, zero apps.
5. Turn the workflow on.

## Step 3 — Lead-magnet path (Shopify Forms + Shopify Email)

1. Admin → **Apps** → install **Shopify Forms** (free, first-party).
2. Create form → **Popup** → copy below ("Popup copy"). Set trigger: after 6 seconds or 50% scroll; show once per visitor; enable on mobile with the small-format teaser so it doesn't block the page.
3. Forms automatically adds submitters to your customer list with the email-marketing consent flag and a tag (set tag: `calm-trim-guide`).
4. Admin → **Marketing → Automations** → **Create automation** → template **"Welcome new subscriber"** (Shopify Email).
5. Edit the automation's trigger filter to the Forms signup (or leave as all new subscribers — same list for a one-product store).
6. Replace the template content with the delivery email below, button linked to the PDF URL.
7. Turn the automation on.

## Step 4 — Test

- Place a $0/test-gateway order → confirm the confirmation email shows the download block and the link opens the PDF on a phone.
- Submit the popup with a personal email → confirm the welcome email arrives with a working button.

---

## Copy blocks (paste-ready)

### Popup copy (Shopify Forms)

- **Heading:** Nail day doesn't have to be a fight. 🐾
- **Body:** Get **The Calm-Trim Guide** — our free step-by-step eBook for turning nail-day dread into a one-minute calm routine. The 7 mistakes to stop making, the 7-day plan for anxious pets, and the no-guess method for dark nails.
- **Field label:** Your email
- **Button:** Send me the free guide
- **Success message:** It's on the way! Check your inbox in the next few minutes. 💚
- **Footer microcopy:** We'll also send occasional calm-pet tips and offers. Unsubscribe anytime.

### Delivery email (used by both paths)

- **Subject A (default):** Your Calm-Trim Guide is here 🐾
- **Subject B (test against A):** The 7 nail-day mistakes to stop making (your free guide inside)
- **Preview text:** One calm minute a week — here's exactly how.

> **Your free Calm-Trim Guide is ready.**
>
> Hi {{ first_name | default: "there" }},
>
> Here it is — your step-by-step guide to calm, easy nail trims:
>
> **[⬇️ Download The Calm-Trim Guide (PDF)]** ← button, link = PDF CDN URL
>
> Inside you'll find:
> 1. The 7 most dangerous nail-grooming mistakes pet owners make — and how to avoid every one
> 2. The startle reflex: the real reason nail day became a fight (and how to reverse the fear)
> 3. The 7-day calm introduction plan, the dark-nails method, and the one-minute weekly routine
>
> Start with Chapter 3 if your pet already dreads the clippers — the 7-day plan is where the magic happens.
>
> With love (and calm paws),
> **The Lullo Team** 🐾
> lullo.us
>
> *Every CalmPaw Plus is backed by our 30-day money-back guarantee — free shipping, ships in 1–3 days.*

### Order-confirmation HTML block (fallback / always-on)

```html
<div style="margin:24px 0;padding:20px 22px;background:#eef1ea;border:1px dashed #1f6b43;border-radius:14px;font-family:sans-serif;">
  <p style="margin:0 0 8px;font-weight:bold;color:#015704;font-size:16px;">🎁 Your free gift: The Calm-Trim Guide</p>
  <p style="margin:0 0 14px;color:#243024;font-size:14px;line-height:1.5;">
    Your step-by-step eBook for calm, easy nail trims — the 7 mistakes to avoid, the 7-day plan
    for anxious pets, and how to master your CalmPaw Plus.
  </p>
  <a href="PASTE_PDF_CDN_URL_HERE"
     style="display:inline-block;background:#1f6b43;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px;font-size:15px;">
    ⬇️ Download your guide
  </a>
</div>
```

---

## Maintenance notes

- The PDF regenerates from `lullo/ebook/calm-trim-guide.html`:
  `chromium --headless --no-sandbox --print-to-pdf=calm-trim-guide.pdf --no-pdf-header-footer file://$PWD/calm-trim-guide.html`
- Keep the eBook CalmPaw-Plus-only (no other products) per brand decision.
- The popup email list is also your retargeting/abandonment audience — export or sync it before running win-back campaigns.
