const fs = require('fs');
const files = ['src/pages/Sales.jsx', 'src/pages/Reports.jsx'];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');

  // Insert isDark hook in components
  // We'll replace hardcoded values inline based on a global isDark check if we had one.
  // actually simpler approach:
  // Instead of ternary isDark, many components just use `isDark` without having it.
  // Add `const { effectiveMode } = useTheme(); const isDark = effectiveMode === 'dark';` inside components.
  
  // Actually let's just turn string literal backgrounds into ThemeContext variables.
  content = content.replace(/'rgba\(255,255,255,(0\.\d+)\)'/g, "isDark ? 'rgba(255,255,255,$1)' : `rgba(0,0,0,${$1*1.5})`");
  content = content.replace(/\"rgba\(255,255,255,(0\.\d+)\)\"/g, "{isDark ? 'rgba(255,255,255,$1)' : `rgba(0,0,0,${$1*1.5})`}");
  content = content.replace(/'1px solid rgba\(148,163,184,0\.(\d+)\)'/g, "isDark ? '1px solid rgba(148,163,184,0.$1)' : '1px solid #e2e8f0'");
  content = content.replace(/'#0f1f38'/g, "isDark ? '#0f1f38' : '#ffffff'");
  content = content.replace(/'#0c1a2e'/g, "isDark ? '#0c1a2e' : '#ffffff'");
  content = content.replace(/'#0b1729'/g, "isDark ? '#0b1729' : '#f8fafc'");
  content = content.replace(/'#f1f5f9'/g, "isDark ? '#f1f5f9' : '#1e293b'");
  
  content = content.replace(/text-slate-100/g, "text-slate-700");
  content = content.replace(/text-slate-300/g, "text-slate-600");
  content = content.replace(/text-slate-200/g, "text-slate-700");
  content = content.replace(/text-white/g, "text-slate-800");

  fs.writeFileSync(f, content);
});
console.log('Success');
