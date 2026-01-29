import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { Car } from '../../types';

export function AdminCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    license_plate: '',
    capacity: '8',
    description: '',
  });

  useEffect(() => {
    loadCars();
  }, []);

  const loadCars = async () => {
    try {
      const data = await api.adminGetCars();
      setCars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cars');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const data = {
      name: form.name,
      license_plate: form.license_plate,
      capacity: parseInt(form.capacity),
      description: form.description,
    };

    try {
      if (editingId) {
        await api.adminUpdateCar(editingId, data);
      } else {
        await api.adminCreateCar(data);
      }
      loadCars();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save car');
    }
  };

  const handleEdit = (car: Car) => {
    setForm({
      name: car.name,
      license_plate: car.license_plate,
      capacity: car.capacity.toString(),
      description: car.description,
    });
    setEditingId(car.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this car?')) return;

    try {
      await api.adminDeleteCar(id);
      loadCars();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete car');
    }
  };

  const resetForm = () => {
    setForm({ name: '', license_plate: '', capacity: '8', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading cars...</div>;
  }

  return (
    <div className="admin-cars">
      <div className="page-header">
        <h1>Manage Cars</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          Add Car
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Car' : 'Add Car'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g., Van 1, Shuttle Bus A"
                />
              </div>
              <div className="form-group">
                <label htmlFor="license_plate">License Plate</label>
                <input
                  id="license_plate"
                  type="text"
                  value={form.license_plate}
                  onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
                  placeholder="e.g., ABC-123"
                />
              </div>
              <div className="form-group">
                <label htmlFor="capacity">Passenger Capacity</label>
                <input
                  id="capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about the vehicle"
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
            <th>License Plate</th>
            <th>Capacity</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id}>
              <td>{car.name}</td>
              <td>{car.license_plate || '-'}</td>
              <td>{car.capacity} seats</td>
              <td>{car.description || '-'}</td>
              <td>
                <button onClick={() => handleEdit(car)} className="btn btn-small">
                  Edit
                </button>
                <button onClick={() => handleDelete(car.id)} className="btn btn-small btn-danger">
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
