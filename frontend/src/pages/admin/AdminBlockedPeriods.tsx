import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { BlockedPeriod } from '../../types';

export function AdminBlockedPeriods() {
  const [periods, setPeriods] = useState<BlockedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ start_time: '', end_time: '', reason: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await api.adminGetBlockedPeriods();
      setPeriods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blocked periods');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.adminUpdateBlockedPeriod(editingId, form);
      } else {
        await api.adminCreateBlockedPeriod(form);
      }
      loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleEdit = (bp: BlockedPeriod) => {
    const toLocal = (s: string) => {
      const d = new Date(s);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    };
    setForm({ start_time: toLocal(bp.start_time), end_time: toLocal(bp.end_time), reason: bp.reason });
    setEditingId(bp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this blocked period?')) return;
    try {
      await api.adminDeleteBlockedPeriod(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const resetForm = () => {
    setForm({ start_time: '', end_time: '', reason: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-blocked-periods">
      <div className="page-header">
        <h1>Blocked Periods</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">Add Blocked Period</button>
      </div>

      {error && <div className="error">{error}</div>}

      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Blocked periods are shown on the driver timeline. They indicate times when no rides should be scheduled.
      </p>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Blocked Period' : 'Add Blocked Period'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="bp-start">Start Time</label>
                <input id="bp-start" type="datetime-local" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div className="form-group">
                <label htmlFor="bp-end">End Time</label>
                <input id="bp-end" type="datetime-local" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
              <div className="form-group">
                <label htmlFor="bp-reason">Reason</label>
                <input id="bp-reason" type="text" value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Main stage performance" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {periods.length === 0 ? (
        <p>No blocked periods defined.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((bp) => (
              <tr key={bp.id}>
                <td>{formatTime(bp.start_time)}</td>
                <td>{formatTime(bp.end_time)}</td>
                <td>{bp.reason || '—'}</td>
                <td>
                  <button onClick={() => handleEdit(bp)} className="btn btn-small">Edit</button>
                  <button onClick={() => handleDelete(bp.id)} className="btn btn-small btn-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
