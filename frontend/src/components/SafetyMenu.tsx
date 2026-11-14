import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useToast } from '../context/Toast';
import { Modal, Spinner } from './ui';

const REASONS = ['Fake profile or scam', 'Inappropriate messages', 'Harassment', 'Inappropriate photos', 'Underage user', 'Asking for money', 'Something else'];
const MIN_DETAILS = 10;

export function SafetyModal({ open, onClose, userId, name }: { open: boolean; onClose: () => void; userId: string; name: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const done = (msg: string) => {
    ['discover', 'matches', 'requests', 'counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    toast({ title: msg, tone: 'success' });
    onClose();
    nav('/discover');
  };
  const report = async () => {
    setBusy(true);
    try {
      await api.post('/reports', { userId, reason, details, block: true });
      done(`Reported and blocked ${name}. Thank you for keeping Match360 safe.`);
    } catch (e) {
      toast({ title: 'Couldn’t send report', body: errMsg(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const block = async () => {
    setBusy(true);
    try {
      await api.post('/blocks', { userId });
      done(`${name} is blocked`);
    } catch (e) {
      toast({ title: 'Couldn’t block', body: errMsg(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Safety">
      <p className="text-sm text-slate">Reports are anonymous. {name} won’t be told who reported them.</p>
      <div className="mt-4 space-y-2">
        {REASONS.map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-[15px] font-semibold transition ${reason === r ? 'border-cobalt/40 bg-cobalt-soft' : 'border-rule bg-card border-rule'}`}>
            <input type="radio" name="reason" className="accent-[#ff5f6d]" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      {reason && <textarea className="input mt-3 min-h-[80px] resize-none" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Briefly, what happened? (required)" />}
      {reason && details.trim().length < MIN_DETAILS && <p className="mt-1.5 text-xs text-slate">Write a short reason so our team can act on it (at least {MIN_DETAILS} characters).</p>}
      <div className="mt-5 grid gap-2">
        <button className="btn btn-primary" disabled={!reason || details.trim().length < MIN_DETAILS || busy} onClick={report}>
          {busy ? <Spinner className="text-white" size={18} /> : <><ShieldAlert size={18} /> Report & block</>}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={block}>Just block {name}</button>
      </div>
    </Modal>
  );
}
