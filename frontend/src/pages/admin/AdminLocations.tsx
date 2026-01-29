import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { Location } from '../../types';

export function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await api.adminGetLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.adminUpdateLocation(editingId, form);
      } else {
        await api.adminCreateLocation(form);
      }
      loadLocations();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location');
    }
  };

  const handleEdit = (location: Location) => {
    setForm({
      name: location.name,
      description: location.description,
    });
    setEditingId(location.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      await api.adminDeleteLocation(id);
      loadLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
    }
  };

  const resetForm = () => {
    setForm({ name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading locations...</div>;
  }

  return (
    <div className="admin-locations">
      <div className="page-header">
        <h1>Manage Locations</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          Add Location
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Location' : 'Add Location'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            <th>Name</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <tr key={location.id}>
              <td>{location.name}</td>
              <td>{location.description || '-'}</td>
              <td>
                <button onClick={() => handleEdit(location)} className="btn btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(location.id)} className="btn btn-small btn-danger">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
