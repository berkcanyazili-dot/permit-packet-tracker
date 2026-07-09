'use client';

type Props = {
  dirty: boolean;
  saving: boolean;
  lastSaved: Date | null;
  onSave: () => void;
  onDiscard: () => void;
};

function formatLastSaved(d: Date | null): string {
  if (!d) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'Saved just now';
  if (diff < 60) return `Saved ${diff}s ago`;
  if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
  return `Saved at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function SaveBar({ dirty, saving, lastSaved, onSave, onDiscard }: Props) {
  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
        dirty
          ? 'border-amber-200 bg-amber-50'
          : 'border-emerald-100 bg-emerald-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${dirty ? 'bg-amber-400' : 'bg-emerald-400'}`}
          aria-hidden="true"
        />
        <span className={dirty ? 'font-medium text-amber-800' : 'text-emerald-700'}>
          {dirty ? 'Unsaved changes' : formatLastSaved(lastSaved)}
        </span>
      </div>

      {dirty && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
