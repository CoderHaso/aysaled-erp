const fs = require('fs');
const files = ['src/pages/Sales.jsx', 'src/pages/Reports.jsx'];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');

  // Background replacements
  content = content.replace(/'rgba\(255,255,255,(0\.\d+)\)'/g, "isDark ? 'rgba(255,255,255,c:\Users\efeha\Documents\aysaled1)' : '#f1f5f9'");
  content = content.replace(/'#0f1f38'/g, "isDark ? '#0f1f38' : '#ffffff'");
  content = content.replace(/'#0c1a2e'/g, "isDark ? '#0c1a2e' : '#ffffff'");
  
  // Slate text updates for text visibility
  content = content.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400');
  content = content.replace(/text-slate-400/g, 'text-slate-600 dark:text-slate-400');
  content = content.replace(/text-white/g, 'text-slate-800 dark:text-white');
  content = content.replace(/text-slate-100/g, 'text-slate-800 dark:text-slate-100');

  // Border updates
  content = content.replace(/'1px solid rgba\(148,163,184,0\.(\d+)\)'/g, "isDark ? '1px solid rgba(148,163,184,0.c:\Users\efeha\Documents\aysaled1)' : '1px solid #e2e8f0'");

  fs.writeFileSync(f, content);
});
console.log('Fixed');
