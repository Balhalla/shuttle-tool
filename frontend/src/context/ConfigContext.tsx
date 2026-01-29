import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type AppConfig } from '../api/client';

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConfig()
      .then((data) => {
        setConfig(data);
        document.title = data.title;
      })
      .catch(() => {
        // Use default title on error
        setConfig({ title: 'Shuttle' });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
