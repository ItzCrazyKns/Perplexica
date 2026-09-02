import path from 'node:path';
import fs from 'fs';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../utils/hash';
import { getModelProvidersUIConfigSection } from '../models/providers';

class ConfigManager {
  configPath: string = path.join(
    process.env.DATA_DIR || process.cwd(),
    '/data/config.json',
  );
  configVersion = 1;
  currentConfig: Config = {
    version: this.configVersion,
    setupComplete: false,
    preferences: {},
    personalization: {},
    modelProviders: [],
    search: {
      searxngURL: '',
    },
  };
  /* Cached parse of the persisted config, keyed by file mtime. Lets repeated
  reads (e.g. isSetupComplete on every layout render) avoid blocking disk
  I/O while still picking up writes made by other Next.js route bundles. */
  private persistedCache: { mtimeMs: number; config: Config } | null = null;
  uiConfigSections: UIConfigSections = {
    preferences: [
      {
        name: 'Theme',
        key: 'theme',
        type: 'select',
        options: [
          {
            name: 'Light',
            value: 'light',
          },
          {
            name: 'Dark',
            value: 'dark',
          },
        ],
        required: false,
        description: 'Choose between light and dark layouts for the app.',
        default: 'dark',
        scope: 'client',
      },
      {
        name: 'Measurement Unit',
        key: 'measureUnit',
        type: 'select',
        options: [
          {
            name: 'Imperial',
            value: 'Imperial',
          },
          {
            name: 'Metric',
            value: 'Metric',
          },
        ],
        required: false,
        description: 'Choose between Metric  and Imperial measurement unit.',
        default: 'Metric',
        scope: 'client',
      },
      {
        name: 'Auto video & image search',
        key: 'autoMediaSearch',
        type: 'switch',
        required: false,
        description: 'Automatically search for relevant images and videos.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show weather widget',
        key: 'showWeatherWidget',
        type: 'switch',
        required: false,
        description: 'Display the weather card on the home screen.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show news widget',
        key: 'showNewsWidget',
        type: 'switch',
        required: false,
        description: 'Display the recent news card on the home screen.',
        default: true,
        scope: 'client',
      },
    ],
    personalization: [
      {
        name: 'System Instructions',
        key: 'systemInstructions',
        type: 'textarea',
        required: false,
        description: 'Add custom behavior or tone for the model.',
        placeholder:
          'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."',
        scope: 'client',
      },
    ],
    modelProviders: [],
    search: [
      {
        name: 'SearXNG URL',
        key: 'searxngURL',
        type: 'string',
        required: false,
        description: 'The URL of your SearXNG instance',
        placeholder: 'http://localhost:4000',
        default: '',
        scope: 'server',
        env: 'SEARXNG_API_URL',
      },
    ],
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.initializeConfig();
    this.initializeFromEnv();
  }

  private saveConfig() {
    /* If the persisted config cannot be read, its contents are unknown.
    Overwriting it with the in-memory snapshot could silently destroy newer
    settings (or another bundle's updates), so let the error propagate and
    abort the write. Route handlers wrap these calls and map the failure to
    their existing 500 response. */
    const latest = this.readPersistedConfig();
    /* Other Next.js bundles may have marked setup complete after this
    instance last loaded the config. Never downgrade true -> false. */
    this.currentConfig.setupComplete =
      latest.setupComplete || this.currentConfig.setupComplete;

    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.currentConfig, null, 2),
    );

    /* Invalidate the mtime-keyed cache: filesystems with coarse timestamp
    granularity can report the same mtimeMs for successive writes, which would
    make the stale cached snapshot look current. */
    this.persistedCache = null;
  }

  private normalizeConfig(raw: any): Config {
    const isRecord = (v: any): v is Record<string, any> =>
      v !== null && typeof v === 'object' && !Array.isArray(v);

    /* Spread the raw object first so unknown persisted top-level fields
    (e.g. written by a newer version or generic settings) survive the
    normalize -> syncFromDisk -> saveConfig round trip, instead of being
    dropped by a fixed literal on the next mutation. Known keys are still
    validated below. */
    return {
      ...(isRecord(raw) ? raw : {}),
      version: raw.version ?? this.configVersion,
      setupComplete: raw.setupComplete === true,
      preferences: isRecord(raw.preferences) ? raw.preferences : {},
      personalization: isRecord(raw.personalization) ? raw.personalization : {},
      modelProviders: Array.isArray(raw.modelProviders)
        ? raw.modelProviders
        : [],
      search: isRecord(raw.search)
        ? {
            searxngURL: '',
            ...raw.search,
          }
        : { searxngURL: '' },
    };
  }

  private parseConfigFromDisk(): Config {
    const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    return this.normalizeConfig(raw);
  }

  private readPersistedConfig(): Config {
    const stat = fs.statSync(this.configPath);

    if (this.persistedCache && this.persistedCache.mtimeMs === stat.mtimeMs) {
      return this.persistedCache.config;
    }

    const config = this.parseConfigFromDisk();
    this.persistedCache = { mtimeMs: stat.mtimeMs, config };
    return config;
  }

  /* Refresh in-memory state from disk before mutating so writes never
  serialize a stale copy (e.g. dropping providers added by other bundles or
  resetting setupComplete to false). Read failures propagate: mutating a
  snapshot while the persisted file is unreadable risks overwriting newer
  state, so callers surface the error instead.

  The cache is cleared before reading so synchronization always starts from
  the actual file bytes: a mutation that aborts without writing (e.g. an
  unknown provider id) used to leave the mtime-keyed entry in place, and on a
  coarse-timestamp filesystem another bundle's write can report the same
  mtimeMs and be shadowed by that stale cached snapshot. The result is also
  cloned so in-place mutations made by callers cannot poison the shared
  persistedCache object when a subsequent writeFileSync fails. */
  private syncFromDisk() {
    this.persistedCache = null;
    this.currentConfig = JSON.parse(JSON.stringify(this.readPersistedConfig()));
  }

  private initializeConfig() {
    const exists = fs.existsSync(this.configPath);
    if (!exists) {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.currentConfig, null, 2),
      );
    } else {
      try {
        this.currentConfig = JSON.parse(
          fs.readFileSync(this.configPath, 'utf-8'),
        );
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error(
            `Error parsing config file at ${this.configPath}:`,
            err,
          );
          console.log(
            'Loading default config and overwriting the existing file.',
          );
          fs.writeFileSync(
            this.configPath,
            JSON.stringify(this.currentConfig, null, 2),
          );
          return;
        } else {
          console.log('Unknown error reading config file:', err);
        }
      }

      this.currentConfig = this.migrateConfig(this.currentConfig);
    }
  }

  private migrateConfig(config: Config): Config {
    /* TODO: Add migrations */
    return config;
  }

  private initializeFromEnv() {
    /* providers section*/
    const providerConfigSections = getModelProvidersUIConfigSection();

    this.uiConfigSections.modelProviders = providerConfigSections;

    const newProviders: ConfigModelProvider[] = [];

    providerConfigSections.forEach((provider) => {
      const newProvider: ConfigModelProvider & { required?: string[] } = {
        id: crypto.randomUUID(),
        name: `${provider.name}`,
        type: provider.key,
        chatModels: [],
        embeddingModels: [],
        config: {},
        required: [],
        hash: '',
      };

      provider.fields.forEach((field) => {
        newProvider.config[field.key] =
          process.env[field.env!] ||
          field.default ||
          ''; /* Env var must exist for providers */

        if (field.required) newProvider.required?.push(field.key);
      });

      let configured = true;

      newProvider.required?.forEach((r) => {
        if (!newProvider.config[r]) {
          configured = false;
        }
      });

      if (configured) {
        const hash = hashObj(newProvider.config);
        newProvider.hash = hash;
        delete newProvider.required;

        const exists = this.currentConfig.modelProviders.find(
          (p) => p.hash === hash,
        );

        if (!exists) {
          newProviders.push(newProvider);
        }
      }
    });

    this.currentConfig.modelProviders.push(...newProviders);

    /* search section */
    this.uiConfigSections.search.forEach((f) => {
      if (f.env && !this.currentConfig.search[f.key]) {
        this.currentConfig.search[f.key] =
          process.env[f.env] ?? f.default ?? '';
      }
    });

    this.saveConfig();
  }

  public getConfig(key: string, defaultValue?: any): any {
    const nested = key.split('.');
    let obj: any = this.currentConfig;

    for (let i = 0; i < nested.length; i++) {
      const part = nested[i];
      if (obj == null) return defaultValue;

      obj = obj[part];
    }

    return obj === undefined ? defaultValue : obj;
  }

  public updateConfig(key: string, val: any) {
    const parts = key.split('.');
    if (parts.length === 0) return;

    this.syncFromDisk();

    let target: any = this.currentConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (target[part] === null || typeof target[part] !== 'object') {
        target[part] = {};
      }

      target = target[part];
    }

    const finalKey = parts[parts.length - 1];
    target[finalKey] = val;

    this.saveConfig();
  }

  public addModelProvider(type: string, name: string, config: any) {
    this.syncFromDisk();

    const newModelProvider: ConfigModelProvider = {
      id: crypto.randomUUID(),
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash: hashObj(config),
    };

    this.currentConfig.modelProviders.push(newModelProvider);
    this.saveConfig();

    return newModelProvider;
  }

  public removeModelProvider(id: string) {
    this.syncFromDisk();
    const index = this.currentConfig.modelProviders.findIndex(
      (p) => p.id === id,
    );

    if (index === -1) return;

    this.currentConfig.modelProviders =
      this.currentConfig.modelProviders.filter((p) => p.id !== id);

    this.saveConfig();
  }

  public async updateModelProvider(id: string, name: string, config: any) {
    this.syncFromDisk();
    const provider = this.currentConfig.modelProviders.find((p) => {
      return p.id === id;
    });

    if (!provider) throw new Error('Provider not found');

    provider.name = name;
    provider.config = config;

    this.saveConfig();

    return provider;
  }

  public addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ) {
    this.syncFromDisk();
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    delete model.type;

    if (type === 'chat') {
      provider.chatModels.push(model);
    } else {
      provider.embeddingModels.push(model);
    }

    this.saveConfig();

    return model;
  }

  public removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ) {
    this.syncFromDisk();
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    if (type === 'chat') {
      provider.chatModels = provider.chatModels.filter(
        (m) => m.key !== modelKey,
      );
    } else {
      provider.embeddingModels = provider.embeddingModels.filter(
        (m) => m.key != modelKey,
      );
    }

    this.saveConfig();
  }

  public isSetupComplete() {
    /* Route handlers and pages are bundled separately by Next.js, so this
    module-level singleton is a different instance in layout.tsx than in
    /api/config/setup-complete. Read directly from disk (never from the
    mtime-keyed cache) so the wizard is dismissed once the API route marks
    setup as complete: cache keys can collide when the filesystem reports the
    same mtimeMs for successive writes. This is a correctness-critical read,
    so the per-request parse is intentional. Read/parse failures propagate so
    a corrupted config surfaces as a server error instead of silently
    rendering the setup wizard. */
    return this.parseConfigFromDisk().setupComplete === true;
  }

  public markSetupComplete() {
    this.syncFromDisk();
    if (!this.currentConfig.setupComplete) {
      this.currentConfig.setupComplete = true;
    }

    this.saveConfig();
  }

  public getUIConfigSections(): UIConfigSections {
    return this.uiConfigSections;
  }

  public getCurrentConfig(): Config {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }
}

const configManager = new ConfigManager();

export default configManager;
