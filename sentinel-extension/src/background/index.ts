import type {
  PageMetadata,
  ThreatAnalysisResult,
  ThreatLevel,
  ThreatType,
  EvidenceRecord,
  SentinelSettings,
} from '../lib/types';
import {
  detectHeuristicThreats,
  calculateThreatScore,
} from '../lib/heuristics';
import { generateReport } from '../lib/report';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  MAX_EVIDENCE_RECORDS,
  SAFE_EXIT_URL,
  IGNORED_URL_PREFIXES,
  THREAT_THRESHOLDS,
} from '../lib/constants';

class SentinelBackground {
  private settings: SentinelSettings = { ...DEFAULT_SETTINGS };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();

    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});
  }

  // ===== Analysis (heuristic-only for Phase 1) =====

  private analyzeWithHeuristics(metadata: PageMetadata): ThreatAnalysisResult {
    const indicators = detectHeuristicThreats(metadata);
    const score = calculateThreatScore(indicators);
    const threshold =
      THREAT_THRESHOLDS[this.settings.sensitivityLevel];

    if (score < threshold) {
      return {
        isThreat: false,
        level: 'low',
        type: 'safe',
        confidence: 1 - score,
        summary: 'No significant threats detected',
        details: [],
      };
    }

    let level: ThreatLevel = 'low';
    if (score >= 0.8) level = 'critical';
    else if (score >= 0.6) level = 'high';
    else if (score >= 0.4) level = 'medium';

    let type: ThreatType = 'suspicious';
    const typeIndicators = indicators.map((i) => i.type);
    if (
      typeIndicators.includes('lookalike_domain') ||
      typeIndicators.includes('external_form_submission')
    ) {
      type = 'phishing';
    } else if (typeIndicators.includes('obfuscated_code')) {
      type = 'malware';
    } else if (typeIndicators.includes('urgency_tactic')) {
      type = 'scam';
    }

    return {
      isThreat: true,
      level,
      type,
      confidence: score,
      summary: `Detected ${indicators.length} threat indicator(s) on this page`,
      details: indicators.map((i) => i.description),
    };
  }

  // ===== Screenshot =====

  private async captureScreenshot(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        null as unknown as number,
        { format: 'png', quality: 90 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        },
      );
    });
  }

  // ===== Evidence Storage =====

  private async saveEvidence(evidence: EvidenceRecord): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    const records: EvidenceRecord[] =
      data[STORAGE_KEYS.EVIDENCE_RECORDS] || [];

    records.push(evidence);

    while (records.length > MAX_EVIDENCE_RECORDS) {
      records.shift();
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.EVIDENCE_RECORDS]: records,
    });

    // Notify sidepanel
    chrome.runtime
      .sendMessage({ type: 'NEW_EVIDENCE', payload: evidence })
      .catch(() => {});
  }

  private async getEvidenceRecords(): Promise<EvidenceRecord[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    return (data[STORAGE_KEYS.EVIDENCE_RECORDS] || []).reverse();
  }

  private async deleteEvidenceRecord(id: string): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_RECORDS);
    const records: EvidenceRecord[] =
      data[STORAGE_KEYS.EVIDENCE_RECORDS] || [];
    const filtered = records.filter((r) => r.id !== id);
    await chrome.storage.local.set({
      [STORAGE_KEYS.EVIDENCE_RECORDS]: filtered,
    });
  }

  // ===== Threat Handling =====

  private async handleThreatDetected(
    tabId: number,
    metadata: PageMetadata,
    analysis: ThreatAnalysisResult,
  ): Promise<void> {
    // 1. Capture screenshot
    let screenshot = '';
    try {
      screenshot = await this.captureScreenshot();
    } catch (err) {
      console.error('[Sentinel] Screenshot failed:', err);
    }

    // 2. Get full DOM snapshot
    let domSnapshot = '';
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' });
      domSnapshot = resp?.dom || '';
    } catch (err) {
      console.error('[Sentinel] DOM capture failed:', err);
    }

    // 3. Build evidence record
    const evidence: EvidenceRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      url: metadata.url,
      domain: metadata.domain,
      screenshot,
      domSnapshot,
      metadata,
      threatAnalysis: analysis,
      exported: false,
    };

    // 4. Persist
    await this.saveEvidence(evidence);

    // 5. Show warning overlay
    chrome.tabs
      .sendMessage(tabId, {
        type: 'SHOW_WARNING',
        payload: {
          level: analysis.level,
          type: analysis.type,
          confidence: analysis.confidence,
          summary: analysis.summary,
        },
      })
      .catch(() => {});

    // 6. Auto-exit for high/critical threats if enabled
    if (
      this.settings.autoExit &&
      (analysis.level === 'high' || analysis.level === 'critical')
    ) {
      chrome.tabs.update(tabId, { url: SAFE_EXIT_URL });
    }
  }

  // ===== Page Analysis Entry Point =====

  private async analyzePage(
    metadata: PageMetadata,
    tabId: number,
  ): Promise<void> {
    // Notify sidepanel that analysis is in progress
    chrome.runtime
      .sendMessage({
        type: 'ANALYSIS_STATUS',
        payload: { analyzing: true, url: metadata.url },
      })
      .catch(() => {});

    try {
      const analysis = this.analyzeWithHeuristics(metadata);

      if (analysis.isThreat) {
        await this.handleThreatDetected(tabId, metadata, analysis);
      }
    } catch (err) {
      console.error('[Sentinel] Analysis error:', err);
    } finally {
      chrome.runtime
        .sendMessage({
          type: 'ANALYSIS_STATUS',
          payload: { analyzing: false },
        })
        .catch(() => {});
    }
  }

  // ===== Settings =====

  private async loadSettings(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    if (data[STORAGE_KEYS.SETTINGS]) {
      this.settings = data[STORAGE_KEYS.SETTINGS];
    }
  }

  private async saveSettings(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: this.settings,
    });
  }

  // ===== Message Router =====

  private handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ): boolean {
    const tabId = sender.tab?.id;

    switch (message.type) {
      // --- Content script messages ---
      case 'PAGE_LOADED': {
        if (this.settings.autoAnalysis && tabId) {
          const url: string = message.payload?.url || '';
          if (!IGNORED_URL_PREFIXES.some((p) => url.startsWith(p))) {
            this.analyzePage(message.payload, tabId);
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'MANUAL_ANALYSIS': {
        if (tabId) {
          this.analyzePage(message.payload, tabId);
        }
        sendResponse({ success: true });
        break;
      }

      case 'EXIT_SITE': {
        if (tabId) {
          chrome.tabs.update(tabId, { url: SAFE_EXIT_URL });
        }
        sendResponse({ success: true });
        break;
      }

      // --- Sidepanel messages ---
      case 'GET_EVIDENCE_LIST': {
        this.getEvidenceRecords().then((records) => {
          sendResponse({ records });
        });
        return true; // async
      }

      case 'DELETE_EVIDENCE': {
        this.deleteEvidenceRecord(message.payload.id).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      case 'GET_SETTINGS': {
        sendResponse({ settings: this.settings });
        break;
      }

      case 'UPDATE_SETTINGS': {
        this.settings = { ...this.settings, ...message.payload };
        this.saveSettings();
        sendResponse({ success: true });
        break;
      }

      case 'EXPORT_REPORT': {
        this.getEvidenceRecords().then((records) => {
          const record = records.find(
            (r) => r.id === message.payload.id,
          );
          if (record) {
            sendResponse({ report: JSON.stringify(generateReport(record), null, 2) });
          } else {
            sendResponse({ error: 'Record not found' });
          }
        });
        return true;
      }

      case 'GET_MODEL_STATUS': {
        // Phase 1: no WebLLM yet, report heuristics-only mode
        sendResponse({
          loaded: false,
          model: 'heuristics-only',
          loadingProgress: 0,
        });
        break;
      }

      case 'TRIGGER_MANUAL_ANALYSIS': {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { type: 'ANALYZE_NOW' });
          }
        });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  }
}

new SentinelBackground();
