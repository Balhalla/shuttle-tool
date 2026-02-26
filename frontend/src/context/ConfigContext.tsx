import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type AppConfig } from '../api/client';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  refreshConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
  refreshConfig: () => {},
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(() => {
    api.getConfig()
      .then((data) => {
        setConfig(data);
        document.title = data.title;
        if (data.favicon_url) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.favicon_url;
        }
      })
      .catch(() => {
        // Use default title on error
        setConfig({ title: 'Shuttle' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <ConfigContext.Provider value={{ config, loading, refreshConfig: loadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
