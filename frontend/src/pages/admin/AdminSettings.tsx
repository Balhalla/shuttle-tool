import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import type { Location } from '../../types';

export function AdminSettings() {
  const { refreshConfig } = useConfig();
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [googleRoutesApiKey, setGoogleRoutesApiKey] = useState('');
  const [baseLocationId, setBaseLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDriverPhones, setShowDriverPhones] = useState(false);

  useEffect(() => {
    Promise.all([api.adminGetSiteSettings(), api.adminGetLocations()])
      .then(([data, locs]) => {
        setBannerEnabled(data.banner_enabled);
        setBannerText(data.banner_text);
        setGoogleRoutesApiKey(data.google_routes_api_key);
        setBaseLocationId(data.base_location_id);
        setShowDriverPhones(data.show_driver_phones);
        setLocations(locs);
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const data = await api.adminUpdateSiteSettings({
        banner_enabled: bannerEnabled,
        banner_text: bannerText,
        google_routes_api_key: googleRoutesApiKey,
        base_location_id: baseLocationId,
        show_driver_phones: showDriverPhones,
      });
      setBannerEnabled(data.banner_enabled);
      setBannerText(data.banner_text);
      setGoogleRoutesApiKey(data.google_routes_api_key);
      setBaseLocationId(data.base_location_id);
      setShowDriverPhones(data.show_driver_phones);
      setMessage('Settings saved.');
      refreshConfig();
    } catch {
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-settings">
      <div className="page-header">
        <h1>Site Settings</h1>
      </div>

      <div style={{ maxWidth: '600px' }}>
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

        <h2>Google Routes API</h2>
        <div className="form-group">
          <label htmlFor="google-routes-api-key">API Key</label>
          <input
            id="google-routes-api-key"
            type="password"
            value={googleRoutesApiKey}
            onChange={(e) => setGoogleRoutesApiKey(e.target.value)}
            placeholder="Enter Google Routes API key..."
            style={{ width: '100%' }}
          />
          <small style={{ color: '#666' }}>Used to fetch driving distances for Car KM Overview.</small>
        </div>

        <h2>Base Location</h2>
        <div className="form-group">
          <label htmlFor="base-location">Base location (home base for cars)</label>
          <select
            id="base-location"
            value={baseLocationId ?? ''}
            onChange={(e) => setBaseLocationId(e.target.value ? parseInt(e.target.value) : null)}
            style={{ width: '100%' }}
          >
            <option value="">None / not set</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <small style={{ color: '#666' }}>Used as the starting/ending point for Car KM calculations.</small>
        </div>

        <h2>Passenger Experience</h2>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={showDriverPhones}
              onChange={(e) => setShowDriverPhones(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Show driver phone numbers to passengers
          </label>
          <br />
          <small style={{ color: '#666' }}>When enabled, passengers can see driver contact info on the ride detail page.</small>
        </div>

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
