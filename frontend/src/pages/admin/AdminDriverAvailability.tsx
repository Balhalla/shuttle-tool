import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { DriverAvailability, User } from '../../types';

export function AdminDriverAvailability() {
  const [availabilities, setAvailabilities] = useState<DriverAvailability[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    driver_id: 0,
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [availData, driversData] = await Promise.all([
        api.adminGetDriverAvailabilities(),
        api.adminGetDrivers(),
      ]);
      setAvailabilities(availData);
      setDrivers(driversData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.driver_id === 0) {
      setError('Please select a driver');
      return;
    }

    if (!form.start_time || !form.end_time) {
      setError('Please set both start and end times');
      return;
    }

    const startDate = new Date(form.start_time);
    const endDate = new Date(form.end_time);

    if (startDate >= endDate) {
      setError('End time must be after start time');
      return;
    }

    try {
      const payload = {
        driver_id: form.driver_id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      };

      if (editingId) {
        await api.adminUpdateDriverAvailability(editingId, payload);
      } else {
        await api.adminCreateDriverAvailability(payload);
      }
      loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    }
  };

  const handleEdit = (avail: DriverAvailability) => {
    setForm({
      driver_id: avail.driver.id,
      start_time: formatDateTimeLocal(avail.start_time),
      end_time: formatDateTimeLocal(avail.end_time),
    });
    setEditingId(avail.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this availability slot?')) return;

    try {
      await api.adminDeleteDriverAvailability(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete availability');
    }
  };

  const resetForm = () => {
    setForm({ driver_id: 0, start_time: '', end_time: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    });
  };

  if (loading) {
    return <div className="loading">Loading driver availability...</div>;
  }

  return (
    <div className="admin-driver-availability">
      <div className="page-header">
        <h1>Driver Availability</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/admin/driver-timeline" className="btn btn-secondary">View Timeline</Link>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add Availability
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Availability' : 'Add Availability'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="driver_id">Driver</label>
                <select
                  id="driver_id"
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: Number(e.target.value) })}
                  required
                >
                  <option value={0}>Select driver...</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="start_time">Start Time</label>
                <input
                  id="start_time"
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="end_time">End Time</label>
                <input
                  id="end_time"
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
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
            <th>Driver</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {availabilities.map((avail) => (
            <tr key={avail.id}>
              <td>{avail.driver.name}</td>
              <td>{formatDateTime(avail.start_time)}</td>
              <td>{formatDateTime(avail.end_time)}</td>
              <td>
                <button onClick={() => handleEdit(avail)} className="btn btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(avail.id)} className="btn btn-small btn-danger">
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {availabilities.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center' }}>
                No availability slots configured yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
