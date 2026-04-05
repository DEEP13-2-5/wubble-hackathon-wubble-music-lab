import { useStore } from '../lib/store.jsx';

export default function ToastContainer() {
  const { state } = useStore();
  return (
    <div className="toast-container">
      {state.toasts.map(t => (
        <div key={t.id} className={`toast${t.type === 'error' ? ' error' : t.type === 'success' ? ' success' : ''}`}>
          <div className="toast-dot" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
