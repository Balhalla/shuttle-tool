import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { TravelTime, Location } from '../../types';

export function AdminTravelTimes() {
  const [travelTimes, setTravelTimes] = useState<TravelTime[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    origin_id: 0,
    destination_id: 0,
    minutes: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [travelTimesData, locationsData] = await Promise.all([
        api.adminGetTravelTimes(),
        api.adminGetLocations(),
      ]);
      setTravelTimes(travelTimesData);
      setLocations(locationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.origin_id === form.destination_id) {
      setError('Origin and destination must be different');
      return;
    }

    if (form.minutes <= 0) {
      setError('Travel time must be greater than 0');
      return;
    }

    try {
      if (editingId) {
        await api.adminUpdateTravelTime(editingId, form);
      } else {
        await api.adminCreateTravelTime(form);
      }
      loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save travel time');
    }
  };

  const handleEdit = (travelTime: TravelTime) => {
    setForm({
      origin_id: travelTime.origin.id,
      destination_id: travelTime.destination.id,
      minutes: travelTime.minutes,
    });
    setEditingId(travelTime.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this travel time?')) return;

    try {
      await api.adminDeleteTravelTime(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete travel time');
    }
  };

  const resetForm = () => {
    setForm({ origin_id: 0, destination_id: 0, minutes: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading travel times...</div>;
  }

  return (
    <div className="admin-travel-times">
      <div className="page-header">
        <h1>Manage Travel Times</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          Add Travel Time
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Travel Time' : 'Add Travel Time'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="origin_id">Origin</label>
                <select
                  id="origin_id"
                  value={form.origin_id}
                  onChange={(e) => setForm({ ...form, origin_id: Number(e.target.value) })}
                  required
                >
                  <option value={0}>Select origin...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="destination_id">Destination</label>
                <select
                  id="destination_id"
                  value={form.destination_id}
                  onChange={(e) => setForm({ ...form, destination_id: Number(e.target.value) })}
                  required
                >
                  <option value={0}>Select destination...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="minutes">Travel Time (minutes)</label>
                <input
                  id="minutes"
                  type="number"
                  min="1"
                  value={form.minutes || ''}
                  onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Origin</th>
            <th>Destination</th>
            <th>Travel Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {travelTimes.map((tt) => (
            <tr key={tt.id}>
              <td>{tt.origin.name}</td>
              <td>{tt.destination.name}</td>
              <td>{tt.minutes} min</td>
              <td>
                <button onClick={() => handleEdit(tt)} className="btn btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(tt.id)} className="btn btn-small btn-danger">
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {travelTimes.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center' }}>
                No travel times configured yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
