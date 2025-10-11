import { SearchProvider, SearchProviderNames } from './types';
import { IBaseFactoryManager } from '../../factories/base';
import { ExaProvider } from './providers/exa';
import { SearxngProvider } from './providers/searxng';
import { TavilyProvider } from './providers/tavily';
import { FirecrawlProvider } from './providers/firecrawl';
import { JinaAIProvider } from './providers/jina-ai';

export class BaseSearchProviderManager
  implements IBaseFactoryManager<SearchProvider, string>
{
  private providerFactories: Map<SearchProviderNames, () => SearchProvider> =
    new Map();

  constructor() {
    this.registerProviderFactory('searxng', () => new SearxngProvider());
    this.registerProviderFactory('exa', () => new ExaProvider());
    this.registerProviderFactory('tavily', () => new TavilyProvider());
    this.registerProviderFactory('firecrawl', () => new FirecrawlProvider());
    this.registerProviderFactory('jina-ai', () => new JinaAIProvider());
  }

  private registerProviderFactory(
    name: SearchProviderNames,
    factory: () => SearchProvider,
  ): void {
    this.providerFactories.set(name, factory);
  }

  public getInstance(name: SearchProviderNames): SearchProvider | null {
    const factory = this.providerFactories.get(name);
    if (factory) {
      return factory();
    }
    return null;
  }

  hasInstance(name: SearchProviderNames): boolean {
    return this.providerFactories.has(name);
  }

  getAllKeys(): string[] {
    return Array.from(this.providerFactories.keys());
  }

  // Keep backward compatibility
  getProvider(name: SearchProviderNames): SearchProvider | null {
    return this.getInstance(name);
  }

  hasProvider(name: SearchProviderNames): boolean {
    return this.hasInstance(name);
  }

  getAllProviders(): string[] {
    return this.getAllKeys();
  }
}

export const baseSearchProviderManager = new BaseSearchProviderManager();
