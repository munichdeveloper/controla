'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCompanionConfig, updateCompanionConfig, deleteCompanionConfig } from '@/lib/api';
import { CompanionConfig } from '@/lib/types';

interface CompanionSettingsPanelProps {
  externalId: string;
}

export function CompanionSettingsPanel({ externalId }: CompanionSettingsPanelProps) {
  const [config, setConfig] = useState<CompanionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<CompanionConfig>({
    host: '',
    port: 3000,
    apiKey: '',
    apiKeyChanged: false,
  });

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanionConfig(externalId);
      setConfig(data);
      setFormData({
        ...data,
        apiKeyChanged: false,
      });
    } catch (err: any) {
      if (err.status === 404) {
        // Config not found, show empty form
        setConfig(null);
      } else {
        setError('Fehler beim Laden der Konfiguration');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, [externalId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) : value,
    }));
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      apiKey: e.target.value,
      apiKeyChanged: true,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const dataToSend = {
        ...formData,
      };
      // Se keine API-Key-Änderung, Key nicht senden
      if (!formData.apiKeyChanged) {
        delete (dataToSend as any).apiKey;
      }
      const saved = await updateCompanionConfig(externalId, dataToSend);
      setConfig(saved);
      setFormData({
        ...saved,
        apiKeyChanged: false,
      });
      alert('Konfiguration gespeichert');
    } catch (err: any) {
      setError('Fehler beim Speichern der Konfiguration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Companion-Konfiguration wirklich löschen?')) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await deleteCompanionConfig(externalId);
      setConfig(null);
      setFormData({
        host: '',
        port: 3000,
        apiKey: '',
        apiKeyChanged: false,
      });
      alert('Konfiguration gelöscht');
    } catch (err: any) {
      setError('Fehler beim Löschen der Konfiguration');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Lädt...</div>;
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Companion-Konfiguration
      </h3>

      {error && (
        <div className="mb-4 p-4 bg-danger/5 text-danger rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Host
          </label>
          <input
            type="text"
            name="host"
            value={formData.host}
            onChange={handleInputChange}
            placeholder="z.B. 192.168.1.100"
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Port
          </label>
          <input
            type="number"
            name="port"
            value={formData.port}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            API-Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={formData.apiKey}
              onChange={handleApiKeyChange}
              placeholder={config ? '●●●●●●●●●' : 'API-Key eingeben'}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-2 text-muted hover:text-muted"
            >
              {showApiKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {config && !formData.apiKeyChanged && (
            <p className="text-xs text-muted mt-1">
              Aktueller Key: {config.apiKey}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
          {config && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-danger/40 text-danger rounded-lg hover:bg-danger/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Löscht...' : 'Löschen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

