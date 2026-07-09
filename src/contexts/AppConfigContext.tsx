import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppConfig {
  appName: string;
}

export const DEFAULT_APP_NAME = 'Meu Racha';

const AppConfigContext = createContext<AppConfig>({ appName: DEFAULT_APP_NAME });

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [appName, setAppName] = useState(DEFAULT_APP_NAME);

  useEffect(() => {
    fetch('/api/public/app-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.appName) {
          setAppName(data.appName);
          document.title = data.appName;
        }
      })
      .catch(() => {
        // Mantém o nome padrão se a chamada falhar (ex.: modo offline).
      });
  }, []);

  return (
    <AppConfigContext.Provider value={{ appName }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}

/** Renderiza o nome do app com a última palavra destacada (ex.: logo de topo/login). */
export function BrandName({ highlightClassName = 'text-[#22c55e]' }: { highlightClassName?: string }) {
  const { appName } = useAppConfig();
  const words = appName.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  const restWords = words.slice(0, -1).join(' ');

  return (
    <>
      {restWords ? `${restWords} ` : ''}
      <span className={highlightClassName}>{lastWord}</span>
    </>
  );
}
