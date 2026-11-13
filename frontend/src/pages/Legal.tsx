import { Link } from 'react-router';
import { Logo } from '../components/Logo';

const COMPANY = 'Resilience Technologies Labs (SMC-Private) Limited, trading as Sustainable Solution 360';
const EMAIL = 'shahnawaz@sustainablesolution360.com';
const UPDATED = '13 November 2026';

type Kind = 'privacy' | 'terms' | 'guidelines' | 'safety' | 'child-safety' | 'refunds' | 'delete-account';
type Doc = { title: string; intro: string; sections: [string, string[]][] };

const DOCS: Record<Kind, Doc> = {
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what Match360 (“we”, “us”), operated by ${COMPANY}, collects, why, who we share it with, and the choices you have.`,
    sections: [
      ['Information you give us', [
        'Account details: your email address and sign-in method (email and password, or Google) through Firebase Authentication.',
        'Profile details: name, date of birth, gender, who you want to see, country, city, hometown, job title, workplace, industry, education, languages, interests, bio, written prompt answers, and optional details such as height, marital status, children, religion, smoking and drinking.',
        'Photos you choose to upload, and a blurred copy of each that we create on your device.',
        'Identity verification documents and a selfie, if you choose to verify.',
        'Payment confirmations you submit: plan, payment method, transaction ID, sender name or number, and an optional receipt screenshot.',
        'Messages you send, your answers to profile questions and results, reports and blocks.',
      ]],
      ['Information collected automatically', [
        'Approximate location, only if you tap “Use my current location” or “Near me”. We round it to about 1 km before storing it and never show it to others; they see only an approximate distance.',
        'Activity needed to run the service, such as when you were last active, and basic technical logs (IP address, device and browser type) used for security and abuse prevention.',
      ]],
      ['How we use information', [
        'To create and show your profile, suggest people, generate profile questions, deliver requests and messages, and send the emails you have enabled.',
        'Profile questions are generated from the profile of the person being asked about. Profile text may be sent to an AI provider to write those questions. It is not used to identify you and we do not send your email, exact birthday or location.',
        'To verify identities and payments, keep the community safe, investigate reports and enforce our Terms.',
        'To show ads to members who do not have Premium.',
      ]],
      ['Who sees your information', [
        'Other members see your public profile: photos (blurred if you choose), first name, age, gender, city, country, work, education, interests, bio, prompt answers and optional details you add. They never see your email, exact birthday, ID documents, payment details or precise location.',
        'Messages are visible only to the two people in the conversation, and to our team when a report requires review.',
        'Verification documents and payment receipts are visible only to authorised Match360 staff.',
      ]],
      ['Service providers', [
        'Google Firebase (sign-in), Railway (servers and database), Cloudflare R2 (photo and document storage), Resend (email), Vercel (website hosting), AI providers such as OpenAI, Google Gemini, Anthropic or Groq (question generation), and Google AdSense or AdMob (ads for free members). They process data only to provide their service to us.',
        'We do not sell your personal information.',
      ]],
      ['Sensitive information', [
        'Religion and other optional details are entirely voluntary and can be removed at any time from Edit profile. Do not add anything you are not comfortable showing to other members.',
      ]],
      ['How long we keep data', [
        'We keep your data while your account is active. When you delete your account, your profile, photos, messages, question results, verification documents and receipts are deleted from our systems within 30 days. We may keep limited records of payments and safety reports where the law requires it or to prevent repeat abuse.',
      ]],
      ['Your choices and rights', [
        'You can view and edit your profile, blur your photos, turn off email notifications, remove your location, hide from Discover with Incognito mode, and delete your account at any time in Settings.',
        `You can ask for a copy of your data or ask us to correct or delete it by emailing ${EMAIL}.`,
      ]],
      ['Security', [
        'Data is encrypted in transit. Sensitive settings are encrypted at rest. Documents are only accessible through short-lived private links. No system is perfectly secure, so please use a strong, unique password.',
      ]],
      ['Children', ['Match360 is only for adults aged 18 and over. We delete accounts we believe belong to anyone younger. See our Child Safety Standards.']],
      ['Changes and contact', [`We will post updates on this page and change the date above. Questions: ${EMAIL}.`]],
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: `These terms are an agreement between you and ${COMPANY} for your use of Match360. By creating an account you accept them.`,
    sections: [
      ['Who can use Match360', ['You must be at least 18 years old, legally able to enter this agreement, and not previously removed from Match360. You may have only one account.']],
      ['Your account', ['Give accurate information about yourself, including your real name, age, work and photos of yourself only. Keep your password secure. You are responsible for activity on your account.']],
      ['How connecting works', ['To send a request you answer questions about the other member’s profile; to accept, they answer questions about yours. Scores are shared with the other person. Questions may be generated by automated systems, including AI, and may occasionally be imperfect.']],
      ['Your content', ['You own what you post. You give us a worldwide, non-exclusive, royalty-free licence to host, display and process it to operate and improve Match360. Do not post anything you do not have the right to share.']],
      ['Conduct', ['Follow our Community Guidelines. We may remove content, limit features, suspend or permanently ban accounts that break these terms, at our discretion and without notice where safety requires it.']],
      ['Premium and payments', [
        'Premium is a paid subscription for a fixed period. Prices are shown before you pay. Payments made by Easypaisa, JazzCash, bank transfer or card link are activated after we confirm them.',
        'In apps downloaded from an app store, subscriptions are sold through that store’s billing system and its terms also apply.',
        'Premium does not renew automatically unless you buy it through an app store subscription. See our Refund Policy.',
      ]],
      ['Ads', ['Free accounts may see ads provided by third parties. Premium removes ads.']],
      ['Safety disclaimer', ['We do not run criminal background checks. Verification confirms an identity document only. You are responsible for your interactions with other members. Read our Safety Tips before meeting anyone.']],
      ['Limitation of liability', ['Match360 is provided “as is”. To the extent allowed by law, we are not liable for indirect or consequential losses, or for the conduct of any member on or off the service.']],
      ['Ending your account', ['You can delete your account at any time in Settings. We may end or suspend accounts that violate these terms.']],
      ['Governing law', ['These terms are governed by the laws of Pakistan, and the courts of Karachi have jurisdiction, unless the law of your country gives you rights that cannot be waived.']],
      ['Contact', [EMAIL]],
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    intro: 'Match360 works because people show up as themselves and treat each other with respect. These rules apply everywhere in the app.',
    sections: [
      ['Be real', ['Use your own name, age and photos. No impersonation, fake profiles or profiles created for someone else. Work and education details must be true.']],
      ['Be respectful', ['No harassment, threats, hate speech, bullying, or unwanted sexual messages. If someone isn’t interested, accept it.']],
      ['Keep it appropriate', ['No nudity, sexual content, graphic violence or illegal content in photos, profiles or messages.']],
      ['No scams or selling', ['Never ask other members for money, gifts, bank details or investments. No advertising, spam or recruiting for other services.']],
      ['Adults only', ['Anyone under 18 is not allowed. Never share content involving minors. See our Child Safety Standards.']],
      ['Reporting', ['Use Report on any profile or chat. Reports are confidential. We review them and may warn, suspend or ban accounts.']],
    ],
  },
  safety: {
    title: 'Safety Tips',
    intro: 'Most people are here for good reasons. These habits help you stay safe with the rest.',
    sections: [
      ['Online', ['Keep conversations in Match360 until you trust someone. Never send money or share bank, CNIC or OTP details. Be cautious of anyone who avoids video calls or pushes to move fast.']],
      ['Meeting in person', ['Meet in a busy public place. Tell a friend or family member where you’ll be and who you’re meeting. Arrange your own transport. Stay in control of your drinks and belongings.']],
      ['If something feels wrong', ['Leave, block and report. In an emergency in Pakistan call 15 (Police) or 1122 (Rescue). Elsewhere, contact your local emergency number.']],
    ],
  },
  'child-safety': {
    title: 'Child Safety Standards',
    intro: 'Match360 has zero tolerance for child sexual abuse and exploitation (CSAE).',
    sections: [
      ['Adults only', ['Every member must be 18 or older. Date of birth is required at sign-up and accounts that appear to belong to minors are removed.']],
      ['Prohibited content and behaviour', ['Any content that sexualises minors, grooming, solicitation of minors, or sharing of child sexual abuse material is strictly prohibited and results in immediate permanent removal.']],
      ['How to report', [`Use Report on the profile or chat and choose “Underage user”, or email ${EMAIL}. Reports involving minors are reviewed with the highest priority.`]],
      ['What we do', ['We remove violating content and accounts, preserve relevant information, and report child sexual abuse material to the relevant authorities, including the National Center for Missing & Exploited Children (NCMEC) and local law enforcement, as required by applicable law.']],
      ['Child safety contact', [`Our designated contact for child safety matters: ${EMAIL}.`]],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    intro: 'We want you to be happy with Premium. Here is how refunds work.',
    sections: [
      ['Payments we could not confirm', ['If we cannot match your Easypaisa, JazzCash, bank or card payment, contact us with your receipt and we will either activate Premium or return the money to the account it came from.']],
      ['Change of mind', [`You can request a full refund within 7 days of activation if you have not used Premium features heavily. Email ${EMAIL} with your transaction ID.`]],
      ['App store purchases', ['Purchases made through Google Play or the App Store are refunded under that store’s policy. Request them from the store.']],
      ['Removed accounts', ['Accounts removed for breaking our Terms or Community Guidelines are not eligible for refunds.']],
      ['Timing', ['Approved refunds are sent within 10 business days to the original payment account.']],
    ],
  },
  'delete-account': {
    title: 'Delete your account',
    intro: 'You can delete your Match360 account and data at any time.',
    sections: [
      ['In the app', ['Open Settings, choose Delete account, type DELETE and confirm. Deletion is immediate and cannot be undone.']],
      ['Without the app', [`Email ${EMAIL} from the address you signed up with and ask us to delete your account. We will confirm within 7 days.`]],
      ['What is deleted', ['Your profile, photos, question results, connection requests, messages, verification documents, receipts and sign-in account. Copies are removed from our systems within 30 days.']],
      ['What may be kept', ['Limited payment records required by law, and information about accounts banned for serious safety violations, to prevent them returning.']],
    ],
  },
};

export default function Legal({ kind }: { kind: Kind }) {
  const d = DOCS[kind];
  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/"><Logo /></Link>
        <h1 className="mt-10 text-4xl font-bold">{d.title}</h1>
        <p className="mt-2 text-sm text-slate">Last updated {UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">{d.intro}</p>
        <div className="mt-8 space-y-8">
          {d.sections.map(([h, paras]) => (
            <section key={h}>
              <h2 className="text-xl font-semibold">{h}</h2>
              {paras.map((t, i) => <p key={i} className="mt-2 leading-relaxed text-slate">{t}</p>)}
            </section>
          ))}
        </div>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-rule pt-6 text-sm">
          {(Object.keys(DOCS) as Kind[]).map((k) => (
            <Link key={k} to={`/${k === 'privacy' ? 'privacy' : k}`} className={k === kind ? 'font-semibold text-ink' : 'text-cobalt hover:underline'}>{DOCS[k].title}</Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
