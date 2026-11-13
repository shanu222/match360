import { Link } from 'react-router';
import { Logo } from '../components/Logo';

const PRIVACY = [
  ['What we collect', 'Your email (via Firebase Authentication), the profile details you enter (name, date of birth, city, job, education, languages, interests, prompts, bio), photos you upload, your challenge answers and scores, connection requests and messages.'],
  ['What others see', 'Other members see your profile, age (never your date of birth) and photos. Your email is never shown. Messages are only visible to the two people in a conversation.'],
  ['Photos', 'Photos are resized in your browser before upload, which removes embedded location (EXIF) data, and are stored on Cloudflare R2.'],
  ['Emails', 'We send emails through Resend only for new challenge requests, new connections, and messages that arrive while you are offline. You can turn these off in Settings.'],
  ['Deleting your data', 'Deleting your account in Settings permanently removes your profile, photos, challenges, connections and messages.'],
  ['Contact', 'Questions? Email shahnawaz@sustainablesolution360.com.'],
];
const TERMS = [
  ['Eligibility', 'You must be at least 18 years old to use Match360.'],
  ['Be genuine', 'Use your real identity and photos of yourself. Do not impersonate anyone.'],
  ['Be respectful', 'Harassment, hate speech, scams, explicit content and spam are not allowed and may lead to removal.'],
  ['Safety', 'Meet in public places and never send money to people you meet online. Report anyone who makes you uncomfortable.'],
  ['Your content', 'You own what you post. You allow us to display it to other members to operate the service.'],
  ['Changes', 'We may update these terms. Continued use means you accept the updated terms.'],
];

export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const items = kind === 'privacy' ? PRIVACY : TERMS;
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link to="/"><Logo /></Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight">{kind === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}</h1>
      <p className="mt-2 text-sm text-ink-400">Last updated: November 2026</p>
      <div className="mt-8 space-y-6">
        {items.map(([h, t]) => (
          <section key={h}>
            <h2 className="font-bold">{h}</h2>
            <p className="mt-1.5 leading-relaxed text-ink-300">{t}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
