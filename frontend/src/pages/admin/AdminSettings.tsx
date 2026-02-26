import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export function AdminSettings() {
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.adminGetSiteSettings().then((data) => {
      setBannerEnabled(data.banner_enabled);
      setBannerText(data.banner_text);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const data = await api.adminUpdateSiteSettings({
        banner_enabled: bannerEnabled,
        banner_text: bannerText,
      });
      setBannerEnabled(data.banner_enabled);
      setBannerText(data.banner_text);
      setMessage('Settings saved.');
    } catch {
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="admin-settings">
      <div className="page-header">
        <h1>Site Settings</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>Banner</h2>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Show banner
          </label>
        </div>
        <div className="form-group">
          <label htmlFor="banner-text">Banner text</label>
          <textarea
            id="banner-text"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            rows={3}
            placeholder="Enter banner message..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
        {bannerEnabled && bannerText && (
          <div className="site-banner" style={{ marginBottom: '1rem' }}>
            Preview: {bannerText}
          </div>
        )}
        <div className="form-actions">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {message && <span style={{ marginLeft: '1rem', color: message.includes('Failed') ? 'red' : 'green' }}>{message}</span>}
        </div>
      </div>
    </div>
  );
}
