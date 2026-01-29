import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { User, Car } from '../../types';

export function AdminDrivers() {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    default_car_id: '' as string,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [driversData, carsData] = await Promise.all([
        api.adminGetDrivers(),
        api.adminGetCars(),
      ]);
      setDrivers(driversData);
      setCars(carsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const data = {
      email: form.email,
      name: form.name,
      phone: form.phone,
      default_car_id: form.default_car_id ? parseInt(form.default_car_id) : null,
    };

    try {
      if (editingId) {
        await api.adminUpdateDriver(editingId, data);
      } else {
        await api.adminCreateDriver(data);
      }
      loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save driver');
    }
  };

  const handleEdit = (driver: User) => {
    setForm({
      email: driver.email,
      name: driver.name,
      phone: driver.phone || '',
      default_car_id: driver.default_car?.id?.toString() || '',
    });
    setEditingId(driver.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      await api.adminDeleteDriver(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete driver');
    }
  };

  const resetForm = () => {
    setForm({ email: '', name: '', phone: '', default_car_id: '' });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading drivers...</div>;
  }

  return (
    <div className="admin-drivers">
      <div className="page-header">
        <h1>Manage Drivers</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          Add Driver
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Driver' : 'Add Driver'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={!!editingId}
                />
              </div>
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
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="default_car">Default Car</label>
                <select
                  id="default_car"
                  value={form.default_car_id}
                  onChange={(e) => setForm({ ...form, default_car_id: e.target.value })}
                >
                  <option value="">No car assigned</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name} ({car.capacity} seats)
                    </option>
                  ))}
                </select>
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
            <th>Email</th>
            <th>Phone</th>
            <th>Default Car</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.id}>
              <td>{driver.name}</td>
              <td>{driver.email}</td>
              <td>{driver.phone || '-'}</td>
              <td>
                {driver.default_car ? (
                  <span>
                    {driver.default_car.name} ({driver.default_car.capacity} seats)
                  </span>
                ) : (
                  <span style={{ color: '#999' }}>No car assigned</span>
                )}
              </td>
              <td>
                <button onClick={() => handleEdit(driver)} className="btn btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(driver.id)} className="btn btn-small btn-danger">
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
