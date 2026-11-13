import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BadgeCheck, Camera, Clock, FileText, ShieldCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { prepareImage } from '../lib/image';
import { uploadBlob } from '../lib/upload';
import type { Verification } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { FullScreenLoader, Spinner } from '../components/ui';

const DOC_TYPES = ['CNIC / National ID', 'Passport', 'Driving licence', 'Student ID', 'Employee ID'];

function Upload({ label, hint, icon: Icon, file, onFile }: { label: string; hint: string; icon: typeof Camera; file: File | null; onFile: (f: File) => void }) {
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <label className={clsx('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors', file ? 'border-cobalt bg-cobalt-soft' : 'border-rule bg-card hover:border-cobalt')}>
      {preview ? <img src={preview} alt="" className="h-32 w-full rounded-lg object-cover" onLoad={() => URL.revokeObjectURL(preview)} /> : <Icon size={28} className="text-cobalt" />}
      <span className="font-semibold">{label}</span>
      <span className="text-sm text-slate">{file ? 'Tap to change' : hint}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" capture={label.includes('Selfie') ? 'user' : undefined} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}

export default function VerifyPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['verification'], queryFn: () => api.get<{ verification: Verification | null }>('/verification') });
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [doc, setDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!me || q.isLoading) return <FullScreenLoader />;
  const v = q.data?.verification;

  const submit = async () => {
    setErr('');
    if (!doc || !selfie) return setErr('Add both photos before submitting.');
    setBusy(true);
    try {
      const [d, s] = await Promise.all([prepareImage(doc, 1800, 0.9).then((b) => uploadBlob('id_doc', b)), prepareImage(selfie, 1400, 0.9).then((b) => uploadBlob('selfie', b))]);
      await api.post('/verification', { docType, docKey: d.key, selfieKey: s.key });
      qc.invalidateQueries({ queryKey: ['verification'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast({ title: 'Documents submitted', body: 'We’ll email you when the review is done.', tone: 'success' });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Verify your profile</h1>
      <p className="mt-2 text-slate">Verified members get a badge and appear in the Verified filter. Your documents are reviewed by the Match360 team only and are never shown to other members.</p>

      {me.user.verified ? (
        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-right/40 bg-right/10 p-5">
          <BadgeCheck className="shrink-0 text-right" size={26} />
          <div><div className="font-semibold">You’re verified</div><div className="text-sm text-slate">The badge shows on your profile.</div></div>
        </div>
      ) : v?.status === 'pending' ? (
        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-rule bg-card p-5">
          <Clock className="shrink-0 text-cobalt" size={26} />
          <div><div className="font-semibold">Review in progress</div><div className="text-sm text-slate">Submitted {new Date(v.created_at).toLocaleDateString()}. Reviews usually take less than 48 hours.</div></div>
        </div>
      ) : (
        <div className="mt-8">
          {v?.status === 'rejected' && (
            <div className="mb-6 rounded-xl bg-wrong/10 p-4 text-sm text-wrong">Your last submission wasn’t approved{v.note ? `: ${v.note}` : '.'} Please try again with clear photos.</div>
          )}
          <ol className="space-y-6">
            <li>
              <div className="font-semibold">1. Choose a document</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {DOC_TYPES.map((d) => <button key={d} onClick={() => setDocType(d)} className={clsx('chip px-3.5 py-2', docType === d && 'chip-on')}>{d}</button>)}
              </div>
            </li>
            <li>
              <div className="font-semibold">2. Add two photos</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Upload label="Document photo" hint="Front side, all four corners visible" icon={FileText} file={doc} onFile={setDoc} />
                <Upload label="Selfie holding the document" hint="Your face and the document both clear" icon={Camera} file={selfie} onFile={setSelfie} />
              </div>
            </li>
          </ol>
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-paper p-4 text-sm text-slate">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-cobalt" />
            Your name and date of birth must match your profile. You can cover your ID number. Documents are stored privately and deleted when you delete your account.
          </div>
          {err && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}
          <button onClick={submit} disabled={busy} className="btn btn-primary mt-6 w-full sm:w-auto">{busy ? <Spinner size={18} className="text-white" /> : 'Submit for review'}</button>
        </div>
      )}
      <p className="mt-8 text-sm text-slate">Questions? Read our <Link to="/privacy" className="text-cobalt underline">Privacy Policy</Link>.</p>
    </div>
  );
}
