# Match360 on Google Play: release notes for the publisher

Everything needed to fill in Play Console for `com.sustainablesolution360.match360`.

## URLs to enter in Play Console

| Field | URL |
| --- | --- |
| Privacy policy | https://match360-psi.vercel.app/privacy |
| Account deletion (Data safety > "Delete account URL") | https://match360-psi.vercel.app/delete-account |
| Child safety standards (required for social and dating apps) | https://match360-psi.vercel.app/child-safety |
| Terms of use | https://match360-psi.vercel.app/terms |
| Community guidelines | https://match360-psi.vercel.app/guidelines |

If you later move the site to your own domain, update these in Play Console.
For the child safety form Play also asks for a contact person: use shahnawaz@sustainablesolution360.com.

## Play Console checklist

1. **Create app**: name "Match360", default language English, type App, Free. Category: Dating (or Social).
2. **Internal testing first**: Testing > Internal testing > Create release > upload `match360-1.0.0.aab`. Accept Play App Signing when asked.
3. **Play App Signing keys back into Firebase**: Test and release > Setup > App integrity > App signing. Copy the SHA-1 and SHA-256 of the **App signing key certificate** and add both in Firebase console > Project settings > Your apps > Android app > Add fingerprint. Without this, Google sign-in fails for everyone who installs from Play.
4. **App content** (Policy > App content):
   - Privacy policy URL (above)
   - Ads: **Yes, my app contains ads**
   - App access: all features need sign-in, so give reviewers a test account (email + password) you created for them
   - Content rating questionnaire (notes below)
   - Target audience: **18 and over** only
   - Data safety (answer sheet below)
   - Advertising ID: **Yes**, used for Advertising or marketing
   - Child safety standards URL and contact (above)
   - Financial features: none. Government app: no. Health: no.
5. **Store listing**: texts and screenshots below, 512x512 icon (`frontend/assets/icon-only.png` scaled down), 1024x500 feature graphic.
6. **New personal developer accounts** (created after 13 Nov 2023): before you can apply for production you must run a **closed test with at least 12 testers opted in for 14 days in a row**. Start it as soon as internal testing looks good. Organisation accounts skip this.
7. **Production**: apply for production access, then promote the release. Countries: choose where you operate.

## Data safety answer sheet

Data is collected: **Yes**. Encrypted in transit: **Yes** (all traffic is HTTPS/WSS). Users can request deletion: **Yes** (in-app Settings > Delete account, and the URL above).

| Data type (Play category) | Collected | Shared with third parties | Purpose | Required or optional |
| --- | --- | --- | --- | --- |
| Name (Personal info) | Yes | No | App functionality, account management | Required |
| Email address (Personal info) | Yes | No | Account management, communications | Required |
| User IDs (Personal info) | Yes | No | Account management | Required |
| Date of birth, gender, and other profile details such as religion, education, work (Personal info > Other info) | Yes | No | App functionality | Date of birth and gender required, the rest optional |
| Photos (Photos and videos) | Yes | No | App functionality (profile) | Required (profile photo) |
| Government ID document and selfie (Personal info > Other info, Photos) | Yes | No | Fraud prevention, safety (identity verification) | Optional |
| Approximate location (Location) | Yes | No by Match360; **Yes** through AdMob for free members (derived from IP) | App functionality ("Near me"), advertising | Optional |
| Precise location | **No** | | | |
| Messages (Messages > Other in-app messages) | Yes | No | App functionality | Optional |
| App interactions (App activity) | Yes | Yes (AdMob) | Analytics, advertising | Required |
| Device or other IDs, including advertising ID (Device or other IDs) | Yes | Yes (AdMob) | Advertising, fraud prevention | Required for free members |
| Diagnostics (App info and performance) | Yes, by the AdMob SDK only | Yes (AdMob) | Analytics | Required |
| Crash logs | No (the app has no crash reporting SDK) | | | |
| Purchase history / financial info | No in the Android app (Premium is not sold in the app in v1.0) | | | |
| Contacts, calendar, files, audio, health, web browsing | No | | | |

Notes for the form:
- "Shared" in Play's sense excludes service providers that process data on your behalf (Firebase, Railway, Cloudflare R2, Resend, AI question generation). AdMob counts as sharing.
- Profile text is sent to an AI provider to write questions. That is processing by a service provider, already described in the privacy policy.
- When you add Google Play Billing, add "Purchase history".

## Content rating notes (IARC questionnaire)

- Category: Social networking / communication (dating).
- Users can interact and communicate with each other: **Yes** (one-to-one chat after both sides connect).
- Users can share user-generated content: **Yes** (profile photos and text). Moderation: report and block on every profile and chat, staff review, bans.
- Shares the user's location with other users: **Yes, approximate only** (others see a rough distance, never a position).
- Digital purchases: **No** in v1.0.
- Violence, sexual content, drugs, gambling: none provided by the app.
- The app is restricted to adults: **18+**. Declare target audience 18 and over; in the store listing do not use imagery that appeals to children.

## Store listing

**App name** (30): Match360

**Short description** (80 max, this is 74):

> Read the profile, answer questions about them, then start the conversation.

**Full description**:

> Match360 is built on one idea: before you message someone, you should know something about them.
>
> Every profile on Match360 has real substance: photos, interests, work, and three short answers written in the person's own words. When you want to connect, you read the profile and answer a few questions about it. Your score goes to the other person along with your request. If they are interested, they answer questions about your profile in return. When both of you have made the effort, the chat opens.
>
> The result is fewer, better conversations. Nobody gets a hundred copy-pasted openers, and nobody has to wonder whether the other person even looked at their profile.
>
> WHO IT'S FOR
> Match360 is for adults looking for a partner, a friend, a co-founder or a study partner. You choose what you are looking for and who you want to see.
>
> HOW IT WORKS
> • Build a profile with photos, interests and three written answers
> • Browse people in Discover, or use Near me to see people close to you
> • Read a profile, then answer a short set of timed questions about it
> • Send your request with your score attached
> • They answer questions about you, and the chat opens when you both pass
>
> PRIVACY YOU CONTROL
> • Blur your photos until you are connected
> • Incognito mode: only people you reach out to can see you
> • Your location is never shown, only an approximate distance, and only if you share it
> • Your email, exact birthday and documents are never visible to other members
>
> SAFETY
> • Optional identity verification with a verified badge
> • Report or block anyone from their profile or from a chat
> • Community guidelines enforced by a real review team
> • Members must be 18 or older
>
> FAIR QUESTIONS
> Questions are written from what a person chose to put on their profile, and are scored on our servers. You get a limited time for each one, so the score reflects what you actually read.
>
> Match360 is free to use and shows ads to free members.
>
> Questions or feedback: shahnawaz@sustainablesolution360.com
>
> Match360 is operated by Resilience Technologies Labs (SMC-Private) Limited, trading as Sustainable Solution 360.

(About 1,900 characters. Do not mention Premium prices or how to pay in the listing while Premium is not sold through Google Play.)

**Screenshots to take** (phone, portrait, 1080x1920 or taller, at least 4; use a test account with good sample photos you have the rights to):

1. Discover: a profile card with the "Read and connect" button
2. A full profile with interests and written answers
3. A question screen mid-quiz with the timer bar
4. The score result screen ("You were paying attention", with the percentage)
5. Requests: an incoming request showing the other person's score
6. A chat conversation
7. Settings: photo blur, incognito and identity verification
8. Sign-in screen (optional)

Take them with the banner ad hidden (use a Premium test account) so no third-party ad appears in the listing.

## Adding Google Play Billing later

Premium cannot be bought inside the Android app in v1.0, because Google Play only allows Play Billing for digital subscriptions. The app shows Premium status and benefits for accounts that already have it. To sell it in the app:

1. Play Console > Monetise > Subscriptions: create products (for example `premium_1m`, `premium_3m`, `premium_12m`) with base plans and prices.
2. App: add a billing plugin, implement `listPremiumProducts` and `purchasePremium` in `frontend/src/native/billing.ts`, set `playBillingAvailable = true`, and render the purchase section in `pages/Premium.tsx` (the place is marked).
3. Backend: a new endpoint that receives the purchase token, verifies it with the Google Play Developer API (`purchases.subscriptionsv2.get`) using a service account linked in Play Console, sets `premium_until`, and acknowledges the purchase. Add a Pub/Sub push endpoint for Real-time Developer Notifications so renewals, cancellations and refunds update `premium_until`.
4. Update the Data safety form (Purchase history) and the content rating (digital purchases: yes).

## App access (reviewer account)

In Play Console > App content > App access, choose "All or some functionality is restricted" and add:

- Name: `Reviewer account`
- Email: `play.review@sustainablesolution360.com`
- Password: stored outside the repo in `C:\Users\USER\match360-keys\play-review-account.txt`
- Other information: "Sign in with email and password on the first screen. Google sign-in is not needed."

The account has a complete profile. To give it Premium (no ads), open the web admin panel > Users, find the email and add Premium days. Accept its pending request from your own account so reviewers also see an open chat.

## AdMob consent message

AdMob > Privacy & messaging > European regulations > create a message for the Match360 app and publish it. Until one exists the app shows ads without a consent prompt, which is not allowed for users in the EEA, UK and Switzerland. "Privacy choices" in Settings opens the form once it exists.

## Buying Premium in the app (Google Play Billing through RevenueCat)

From version 1.1.0 the Android app sells Premium with Google Play Billing, using RevenueCat. The website's manual payment methods are still never shown in the app.

How it fits together:

- **App** (`frontend/src/native/billing.ts`, `frontend/src/pages/Premium.tsx`): shows the packages of the current RevenueCat offering with Google Play's prices, opens Google's purchase sheet, and offers "Restore purchases". The RevenueCat customer ID is the Match360 account ID.
- **Backend** (`backend/src/routes/billing.ts`): `POST /api/webhooks/revenuecat` is called by RevenueCat on every purchase, renewal, cancellation, refund and expiry. `POST /api/billing/sync` is called by the app right after a purchase. Both read the entitlement from RevenueCat's API and set the Premium end date. The app is never trusted to grant Premium.
- **Database**: `users.store_premium_until` holds the store's end date; `users.premium_until` stays the effective date. Premium granted on the website or by an admin that runs longer than the store subscription is not shortened.

Configuration:

| Where | Name | Value |
| --- | --- | --- |
| `frontend/.env.android` | `VITE_REVENUECAT_ANDROID_KEY` | RevenueCat public SDK key for the Play Store app (`goog_…`). Public by design. Never a `test_` key. |
| Railway (backend) | `REVENUECAT_WEBHOOK_AUTH` | A long random string. Must equal the "Authorization header value" of the webhook in RevenueCat. |
| Railway (backend) | `REVENUECAT_SECRET_KEY` | RevenueCat secret API key (`sk_…`). Backend only. |
| Railway (backend) | `REVENUECAT_ENTITLEMENT` | `premium` (the default; only set it if the entitlement is named differently). |

RevenueCat: entitlement `premium`, with the Play subscription products attached, and a `default` offering with one package per plan. Webhook URL: `https://<backend host>/api/webhooks/revenuecat`.

Play Console: subscription products for Match360 with an active base plan each; licence testers under Settings > Licence testing; "Purchase history" added to Data safety (collected, not shared, app functionality, required for buyers).
