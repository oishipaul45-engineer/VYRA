import './VyraPulse.css';

type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'conflict';

type Props = {
  balance: string;
  syncStatus: SyncStatus;
  reducedMotion: boolean;
  onSyncAction: () => void;
};

export default function VyraPulse({ balance, syncStatus, reducedMotion, onSyncAction }: Props) {
  const actionable = syncStatus === 'offline' || syncStatus === 'conflict';
  const statusText: Record<SyncStatus, string> = {
    loading: 'Connecting',
    synced: 'Cloud saved',
    saving: 'Saving changes',
    offline: 'Retry cloud sync',
    conflict: 'Review sync conflict',
  };
  return (
    <section className={'vyra-pulse' + (reducedMotion ? ' vyra-pulse--still' : '')} aria-label="VYRA Pulse demo balance and cloud status">
      <div className="vyra-pulse__top">
        <span className="vyra-pulse__eyebrow">VYRA / PULSE</span>
        <span className="vyra-pulse__live" aria-hidden="true"><span/><span/><span/></span>
      </div>
      <div className="vyra-pulse__label">DEMO BALANCE</div>
      <div className="vyra-pulse__amount" title="Simulated account balance">{balance}</div>
      <div className="vyra-pulse__bottom">
        <span className={'vyra-pulse__dot vyra-pulse__dot--' + syncStatus} aria-hidden="true"/>
        {actionable ? (
          <button type="button" className="vyra-pulse__sync vyra-pulse__sync--action" onClick={onSyncAction} title="Open VYRA synchronization recovery">
            {statusText[syncStatus]} <span aria-hidden="true">â†—</span>
          </button>
        ) : <span className="vyra-pulse__sync" role="status">{statusText[syncStatus]}</span>}
      </div>
      <span className="vyra-pulse__watermark" aria-hidden="true">V.</span>
    </section>
  );
}