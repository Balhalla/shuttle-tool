import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'public' as 'public' | 'driver' | 'admin',
    phone: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.adminGetUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.adminUpdateUser(editingId, form);
      } else {
        await api.adminCreateUser(form);
      }
      loadUsers();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    }
  };

  const handleEdit = (user: User) => {
    setForm({
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || '',
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleRoleChange = async (user: User, newRole: 'public' | 'driver' | 'admin') => {
    if (user.id === currentUser?.id && newRole !== 'admin') {
      if (!confirm('You are about to remove your own admin privileges. Are you sure?')) {
        return;
      }
    }

    try {
      await api.adminUpdateUser(user.id, { role: newRole });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDelete = async (id: number) => {
    if (id === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.adminDeleteUser(id);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const resetForm = () => {
    setForm({ email: '', name: '', role: 'public', phone: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'role-badge admin';
      case 'driver':
        return 'role-badge driver';
      default:
        return 'role-badge public';
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="admin-users">
      <div className="page-header">
        <h1>Manage Users</h1>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          Add User
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit User' : 'Add User'}</h2>
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
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as 'public' | 'driver' | 'admin' })
                  }
                >
                  <option value="public">Public</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
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
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                {user.name}
                {user.id === currentUser?.id && <span className="you-badge">(you)</span>}
              </td>
              <td>{user.email}</td>
              <td>{user.phone || '-'}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) =>
                    handleRoleChange(user, e.target.value as 'public' | 'driver' | 'admin')
                  }
                  className={getRoleBadgeClass(user.role)}
                >
                  <option value="public">Public</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{formatDate(user.created_at)}</td>
              <td>
                <button onClick={() => handleEdit(user)} className="btn btn-small">
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="btn btn-small btn-danger"
                  disabled={user.id === currentUser?.id}
                >
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
