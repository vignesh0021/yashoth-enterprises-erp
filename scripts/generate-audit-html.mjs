import fs from 'node:fs';

const md = fs.readFileSync('docs/FORENSIC_BASELINE_AUDIT.md', 'utf-8');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const lines = md.split('\n');
let htmlBody = '';
let inCodeBlock = false;
let codeLang = '';
let codeContent = '';
let inTable = false;

for (let line of lines) {
  if (line.startsWith('```')) {
    if (inCodeBlock) {
      inCodeBlock = false;
      htmlBody += `<pre><code>${escapeHtml(codeContent)}</code></pre>\n`;
      codeContent = '';
    } else {
      inCodeBlock = true;
      codeLang = line.replace('```', '').trim();
    }
    continue;
  }

  if (inCodeBlock) {
    codeContent += line + '\n';
    continue;
  }

  if (line.startsWith('# ')) {
    htmlBody += `<h1>${line.replace('# ', '')}</h1>\n`;
  } else if (line.startsWith('## ')) {
    htmlBody += `<h2>${line.replace('## ', '')}</h2>\n`;
  } else if (line.startsWith('### ')) {
    htmlBody += `<h3>${line.replace('### ', '')}</h3>\n`;
  } else if (line.startsWith('#### ')) {
    htmlBody += `<h4>${line.replace('#### ', '')}</h4>\n`;
  } else if (line.startsWith('- ')) {
    let item = line.replace('- ', '');
    item = item.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    item = item.replace(/\`([^`]+)\`/g, '<code>$1</code>');
    htmlBody += `<li>${item}</li>\n`;
  } else if (line.startsWith('|')) {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0 && !parts[0].includes('---')) {
      htmlBody += '<tr>' + parts.map(p => {
        let cell = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        cell = cell.replace(/\`([^`]+)\`/g, '<code>$1</code>');
        return `<td>${cell}</td>`;
      }).join('') + '</tr>\n';
    }
  } else if (line.trim().length > 0) {
    let para = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    para = para.replace(/\`([^`]+)\`/g, '<code>$1</code>');
    htmlBody += `<p>${para}</p>\n`;
  }
}

const styledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Yashoth Enterprises ERP — Forensic Baseline Audit</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; padding: 16px; max-width: 900px; margin: 0 auto; }
  h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 22px; }
  h2 { color: #1e3a8a; margin-top: 26px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 18px; }
  h3 { color: #b91c1c; margin-top: 20px; font-size: 16px; }
  pre { background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  code { background: #e2e8f0; color: #b91c1c; padding: 2px 5px; border-radius: 4px; font-size: 12px; font-family: monospace; }
  pre code { background: none; color: inherit; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #fff; border-radius: 6px; overflow: hidden; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
  tr:nth-child(even) { background: #f1f5f9; }
  ul { padding-left: 20px; }
  li { margin-bottom: 5px; font-size: 13px; }
  p { font-size: 13px; margin: 6px 0; }
  .header-card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
</style>
</head>
<body>
<div class="header-card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
    <span style="font-size: 12px; font-weight: 800; color: #dc2626; background: #fef2f2; padding: 4px 10px; border-radius: 6px;">YASHOTH ENTERPRISES ERP</span>
    <span style="font-size: 11px; color: #64748b;">Branch: hardening/production-readiness</span>
  </div>
  ${htmlBody}
</div>
</body>
</html>`;

fs.writeFileSync('docs/FORENSIC_BASELINE_AUDIT.html', styledHtml);
try {
  fs.writeFileSync('/sdcard/Download/FORENSIC_BASELINE_AUDIT.html', styledHtml);
} catch (e) {}
console.log('Successfully generated docs/FORENSIC_BASELINE_AUDIT.html and /sdcard/Download/FORENSIC_BASELINE_AUDIT.html');
