import { useState, useEffect, useCallback } from 'react'
import { 
  Settings, 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  History, 
  ChevronRight,
  Loader2,
  Clock,
  ExternalLink,
  AlertCircle,
  Link,
  FileText,
  AlertTriangle,
  Info,
  Save,
  X
} from 'lucide-react'
import { findAlternativePerspectives, type TavilySearchResult } from '../services/tavilyService.ts'
import { generateCrossCheckReport, type CrossCheckReport } from '../services/geminiService.ts'

interface ScrapedData {
  title: string;
  body: string;
  author: string;
  date: string;
  url: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  article: ScrapedData;
  report: CrossCheckReport;
  sources: TavilySearchResult[];
}

export function SidePanel() {
  const [currentTab, setCurrentTab] = useState<'check' | 'archive' | 'settings'>('check');
  const [showMethodology, setShowMethodology] = useState(false);
  
  // Storage State
  const [geminiKey, setGeminiKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [articleData, setArticleData] = useState<ScrapedData | null>(null);
  const [secondarySources, setSecondarySources] = useState<TavilySearchResult[]>([]);
  const [analysisReport, setAnalysisReport] = useState<CrossCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load from Storage on mount
  useEffect(() => {
    chrome.storage.local.get(['geminiApi', 'tavilyApi', 'analysisHistory'], (result) => {
      if (result.geminiApi) setGeminiKey(result.geminiApi as string);
      if (result.tavilyApi) setTavilyKey(result.tavilyApi as string);
      if (result.analysisHistory) setHistory(result.analysisHistory as HistoryItem[]);
    });
  }, []);

  const saveSettings = () => {
    chrome.storage.local.set({ 
      geminiApi: geminiKey.trim(), 
      tavilyApi: tavilyKey.trim() 
    });
    setCurrentTab('check');
  };

  const saveToHistory = (article: ScrapedData, report: CrossCheckReport, sources: TavilySearchResult[]) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      article,
      report,
      sources
    };
    
    // Prepend and keep only the last 10
    const newHistory = [newItem, ...history].slice(0, 10);
    setHistory(newHistory);
    chrome.storage.local.set({ analysisHistory: newHistory });
  };

  const handleScrape = useCallback(async () => {
    setError(null);
    setSecondarySources([]); 
    setAnalysisReport(null);
    try {
      const tabs = await chrome.tabs.query({ url: [
        "*://*.reuters.com/*", "*://*.bbc.com/*", "*://*.bbc.co.uk/*",
        "*://*.cnn.com/*", "*://*.nytimes.com/*", "*://*.apnews.com/*",
        "*://*.theguardian.com/*", "*://*.foxnews.com/*", "*://*.aljazeera.com/*",
        "*://*.bloomberg.com/*"
      ] });
      
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const targetTab = tabs.find(t => t.id === activeTab?.id) || tabs[0];

      if (!targetTab?.id) {
        setError('No supported news article found in your open tabs. Navigate to a news site (e.g., BBC, Reuters) to begin.');
        setArticleData(null);
        return;
      }

      chrome.tabs.sendMessage(targetTab.id, { action: 'SCRAPE_ARTICLE' }, (response) => {
        if (chrome.runtime.lastError) {
          setError('Communication failed. Refresh the news page and try again.');
          return;
        }
        if (response) {
          setArticleData(response);
        } else {
          setError('Failed to extract article content. Ensure the page is a supported news domain.');
        }
      });
    } catch (err) {
      setError('An error occurred while connecting to the browser tabs.');
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'check' && !articleData) handleScrape();
  }, [handleScrape, currentTab, articleData]);

  const loadHistoryItem = (item: HistoryItem) => {
    setArticleData(item.article);
    setSecondarySources(item.sources);
    setAnalysisReport(item.report);
    setError(null);
    setCurrentTab('check');
  };

  const handleAnalyze = async () => {
    if (!geminiKey || !tavilyKey) {
      setCurrentTab('settings');
      setError('Please configure your API keys first.');
      return;
    }
    
    if (!articleData) return;
    setIsAnalyzing(true);
    setError(null);
    setSecondarySources([]);
    setAnalysisReport(null);
    
    try {
      const perspectives = await findAlternativePerspectives(tavilyKey, articleData.title, articleData.url);
      setSecondarySources(perspectives);
      
      if (perspectives.length > 0) {
        const report = await generateCrossCheckReport(
          geminiKey,
          { title: articleData.title, body: articleData.body },
          perspectives
        );
        setAnalysisReport(report);
        saveToHistory(articleData, report, perspectives);
      } else {
        setError('Research failed: No alternative perspectives found for comparison.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred.';
      setError(`Analysis failed: ${message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConflictStyle = (level: string) => {
    switch(level) {
      case 'High': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    }
  };

  const timeAgo = (timestamp: number) => {
    const min = Math.floor((Date.now() - timestamp) / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  };

  return (
    <div className="flex flex-col h-screen bg-surface font-inter">
      <header className="bg-header text-white px-4 py-4 flex items-center justify-between shadow-xl z-20 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight uppercase leading-none mt-0.5">News Cross-Check</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentTab('settings')}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
            <Settings className="w-4 h-4 opacity-80" />
          </button>
        </div>
      </header>

      {showMethodology && (
        <div 
          onClick={() => setShowMethodology(false)}
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-on-surface/10 animate-in fade-in zoom-in-95 cursor-default"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold uppercase tracking-wider text-primary text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Methodology
              </h3>
              <button onClick={() => setShowMethodology(false)} className="opacity-50 hover:opacity-100 hover:text-rose-500 transition-colors cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-on-surface/80 leading-relaxed font-medium">
              <p>1. <strong>Extraction:</strong> We pull the article's core text from supported news publishers.</p>
              <p>2. <strong>Research:</strong> We query the <em>Tavily Search API</em> to find 3 distinct, alternative sources reporting on the same topic.</p>
              <p>3. <strong>Analysis:</strong> We provide the primary text and alternative snippets to <em>Gemini 2.5 Flash</em>. Gemini compares them holistically, identifying omissions and structural biases.</p>
            </div>
            <button onClick={() => setShowMethodology(false)} className="w-full mt-6 py-3 bg-surface-container hover:bg-surface-container/80 transition-colors font-bold text-xs uppercase tracking-widest rounded-lg cursor-pointer hover:text-primary">
              Close
            </button>
          </div>
        </div>
      )}

      {currentTab !== 'settings' && (
        <nav className="flex px-4 pt-4 gap-4 bg-surface shadow-sm sticky top-0 z-10 shrink-0">
          <button 
            onClick={() => setCurrentTab('check')}
            className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
              currentTab === 'check' 
                ? 'border-primary text-on-surface' 
                : 'border-transparent text-on-surface/40 hover:text-on-surface/60'
            }`}
          >
            Cross-Check
          </button>
          <button 
            onClick={() => setCurrentTab('archive')}
            className={`pb-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
              currentTab === 'archive' 
                ? 'border-primary text-on-surface' 
                : 'border-transparent text-on-surface/40 hover:text-on-surface/60'
            }`}
          >
            Archive
          </button>
        </nav>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide relative">
        {currentTab === 'settings' ? (
          <section className="bg-surface-card rounded-xl p-6 shadow-xl border border-on-surface/5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configuration
            </h2>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/60">Gemini API Key</label>
                <input 
                  type="password" 
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-3 bg-surface-container text-on-surface rounded-lg border border-on-surface/10 text-sm focus:border-primary outline-none transition-all"
                />
                <p className="text-[10px] font-medium text-on-surface/40">Required for AI analysis. <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline text-primary/70 hover:text-primary">Get Key</a></p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/60">Tavily API Key</label>
                <input 
                  type="password" 
                  value={tavilyKey}
                  onChange={e => setTavilyKey(e.target.value)}
                  placeholder="tvly-..."
                  className="w-full p-3 bg-surface-container text-on-surface rounded-lg border border-on-surface/10 text-sm focus:border-primary outline-none transition-all"
                />
                <p className="text-[10px] font-medium text-on-surface/40">Required for alternative source search. <a href="https://app.tavily.com/home" target="_blank" className="underline text-primary/70 hover:text-primary">Get Key</a></p>
              </div>

              <div className="pt-4 border-t border-on-surface/10">
                <button 
                  onClick={saveSettings}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-dim text-white font-bold text-xs uppercase tracking-widest rounded-md transition-all shadow-lg shadow-primary/20"
                >
                  <Save className="w-4 h-4" /> Save Keys
                </button>
              </div>
            </div>
          </section>
        ) : currentTab === 'check' ? (
          <>
            <section className={`bg-surface-card rounded-xl p-6 shadow-2xl shadow-on-surface/5 transition-all duration-500 transform ${isAnalyzing ? 'scale-[0.98]' : 'scale-100'}`}>
              <div className="relative group overflow-hidden">
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer z-10 pointer-events-none" />
                )}
                
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold uppercase text-on-surface/40 tracking-widest">Active Article</h2>
                  {articleData && (
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-500/80">
                      <ShieldCheck className="w-3 h-3" /> Eyes Connected
                    </span>
                  )}
                </div>
                
                <div className="space-y-4">
                  {error ? (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 border border-amber-100 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-medium leading-relaxed">{error}</p>
                    </div>
                  ) : articleData ? (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold leading-tight text-on-surface">{articleData.title}</h3>
                      <div className="flex items-center gap-2 p-2 bg-surface-container rounded-lg text-xs font-medium text-on-surface/60">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{articleData.url}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface/40">
                        <span>{articleData.author || 'Unknown'}</span>
                        <span>{articleData.date || 'Recent'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest text-on-surface/20">Awaiting Article...</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={handleScrape}
                      disabled={isAnalyzing}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container hover:bg-surface-container/80 text-primary font-bold text-xs uppercase tracking-widest rounded-md transition-all"
                    >
                      <Search className="w-4 h-4" /> Re-Scan
                    </button>
                    <button 
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !articleData}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-dim text-white font-bold text-xs uppercase tracking-widest rounded-md transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="w-4 h-4 animate-spin text-white" /> Analyzing...</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4" /> Cross-Check</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {analysisReport && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-white border border-on-surface/5 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-4 border-on-surface/5">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface/40 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> AI Findings
                    </h3>
                    <div className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getConflictStyle(analysisReport.conflictLevel)}`}>
                      Conflict Level: {analysisReport.conflictLevel}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-primary" /> Editorial Framing
                    </h4>
                    <p className="text-sm font-medium leading-relaxed text-on-surface/80">{analysisReport.framing}</p>
                  </div>

                  {analysisReport.omissions.length > 0 && (
                    <div className="pt-4 space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" /> Key Omissions
                      </h4>
                      <ul className="space-y-2">
                        {analysisReport.omissions.map((omission, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs font-medium text-on-surface/70 bg-surface-container/30 p-2 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {omission}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-2 px-1">
                    <Link className="w-3.5 h-3.5 text-on-surface/30" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface/40">Verified Sources</h3>
                  </div>

                  <div className="space-y-3">
                    {secondarySources.map((source, index) => (
                      <div key={index} className="bg-white border border-on-surface/5 p-4 rounded-xl shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-on-surface/5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                            {new URL(source.url).hostname.replace('www.', '')}
                          </span>
                          <a href={source.url} target="_blank" rel="noreferrer" className="text-on-surface/20 group-hover:text-primary transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <h4 className="text-sm font-bold leading-tight mb-2 text-on-surface">{source.title}</h4>
                        
                        <div className="bg-emerald-50/40 p-3 rounded-lg flex gap-2">
                          <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-medium text-emerald-800/80 leading-relaxed italic">
                            "{analysisReport.sourcePerspectives[`S${index + 1}`] || 'Adds diverse context to the coverage.'}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {history.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-on-surface/5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface/40 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Recent Checks
                  </h3>
                  <button onClick={() => setCurrentTab('archive')} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">View All</button>
                </div>
                <div className="space-y-3">
                  {history.slice(0, 3).map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => loadHistoryItem(item)}
                      className="flex items-center justify-between p-3 bg-white border border-on-surface/5 rounded-xl transition-all cursor-pointer shadow-sm hover:border-primary/30 hover:shadow-md group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                          <ShieldCheck className={`w-5 h-5 ${item.report.conflictLevel === 'High' ? 'text-rose-400' : item.report.conflictLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-on-surface line-clamp-1 truncate max-w-[180px]">{item.article.title}</h4>
                          <p className="text-[10px] uppercase font-bold text-on-surface/40 mt-0.5">{timeAgo(item.timestamp)}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {history.length > 0 ? history.map((item) => (
               <div 
                 key={item.id} 
                 onClick={() => loadHistoryItem(item)}
                 className="p-4 bg-white border border-on-surface/5 rounded-xl shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
               >
                 <div className="flex justify-between items-start border-b border-on-surface/5 pb-3 group-hover:border-primary/10 transition-colors">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40 block mb-1">{timeAgo(item.timestamp)}</span>
                      <h4 className="text-sm font-bold text-on-surface leading-tight group-hover:text-primary transition-colors">{item.article.title}</h4>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary shrink-0 mt-2" />
                 </div>
                 <div className="flex gap-2 items-center">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${getConflictStyle(item.report.conflictLevel)}`}>
                      Conflict: {item.report.conflictLevel}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface/50 border border-on-surface/10 rounded px-2 py-1">
                      {item.sources.length} Sources
                    </span>
                 </div>
               </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4 py-20">
                <div className="bg-surface-container p-6 rounded-full">
                  <History className="w-12 h-12" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">No Archived Checks</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Bleed Footer */}
      <footer className="p-4 border-t border-on-surface/5 bg-white/50 backdrop-blur-sm sticky bottom-0 z-10 shrink-0">
        <button 
          onClick={() => setShowMethodology(true)}
          className="flex items-center justify-between w-full p-3 bg-surface-container border border-transparent rounded-xl hover:bg-surface-container/70 hover:border-primary/20 hover:shadow-sm cursor-pointer transition-all group"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface/60 group-hover:text-primary transition-colors">Verification Methodology</span>
          <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-primary transition-all" />
        </button>
      </footer>
    </div>
  );
}
