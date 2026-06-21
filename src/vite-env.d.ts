declare const __APP_VERSION__: string

interface Window {
  electronAPI?: {
    getAppVersion: () => Promise<string>
  }
}
