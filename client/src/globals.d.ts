declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
	readonly VITE_PLAUSIBLE_DOMAIN?: string;
	readonly VITE_PLAUSIBLE_SRC?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface PlausibleQueueable {
	(eventName: string, options?: { props?: Record<string, string | number | boolean> }): void;
	q?: Array<[string, { props?: Record<string, string | number | boolean> } | undefined]>;
}

interface Window {
	plausible?: PlausibleQueueable;
}
