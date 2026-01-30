// Performance utilities
class PerformanceTracker {
  constructor() {
    this.metrics = {};
    this.startTime = performance.now();
  }
  
  mark(name) {
    this.metrics[name] = performance.now();
  }
  
  measure(from, to, name) {
    if (this.metrics[from] && this.metrics[to]) {
      const duration = this.metrics[to] - this.metrics[from];
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      
      // Envoyer à analytics si nécessaire
      if (typeof gtag !== 'undefined') {
        gtag('event', 'timing_complete', {
          name,
          value: Math.round(duration),
          event_category: 'Performance'
        });
      }
    }
  }
  
  logLCP() {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log(`🎯 LCP: ${lastEntry.startTime.toFixed(2)}ms`);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }
  
  logCLS() {
    let cls = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      }
      console.log(`📊 CLS: ${cls.toFixed(4)}`);
    }).observe({ type: 'layout-shift', buffered: true });
  }
}

// Initialiser
window.VOORSPerf = new PerformanceTracker();