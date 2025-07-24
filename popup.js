// Copy Clean for Sheets - Popup Script with Debug Mode
document.addEventListener('DOMContentLoaded', function() {
  const copyButton = document.getElementById('copyButton');
  const statusDiv = document.getElementById('status');
  let debugMode = false;
  
  // Add debug toggle and output area
  const debugToggle = document.createElement('label');
  debugToggle.style.cssText = 'display: block; margin: 10px 0; font-size: 12px;';
  debugToggle.innerHTML = '<input type="checkbox" id="debugMode"> Debug mode';
  statusDiv.parentNode.insertBefore(debugToggle, statusDiv);
  
  const debugOutput = document.createElement('textarea');
  debugOutput.id = 'debugOutput';
  debugOutput.style.cssText = 'width: 100%; height: 150px; margin-top: 10px; font-family: monospace; font-size: 10px; display: none;';
  debugOutput.readOnly = true;
  statusDiv.parentNode.appendChild(debugOutput);
  
  document.getElementById('debugMode').addEventListener('change', (e) => {
    debugMode = e.target.checked;
    debugOutput.style.display = debugMode ? 'block' : 'none';
  });
  
  // Main copy handler
  copyButton.addEventListener('click', async function() {
    try {
      copyButton.disabled = true;
      showStatus('Processing...', 'info');
      
      // Verify we're on Google Sheets
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url?.includes('docs.google.com/spreadsheets')) {
        showStatus('Please open a Google Sheets document', 'error');
        return;
      }
      
      // Read and process clipboard
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        showStatus('No data in clipboard. Please copy cells first (Ctrl+C)', 'error');
        return;
      }
      
      if (debugMode) {
        let debugText = '=== RAW CLIPBOARD DATA ===\n';
        debugText += 'Length: ' + clipboardText.length + '\n';
        debugText += 'First 200 chars: ' + JSON.stringify(clipboardText.substring(0, 200)) + '\n\n';
        
        // Analyze first line
        const firstLine = clipboardText.split('\n')[0];
        debugText += 'First line analysis:\n';
        debugText += 'Length: ' + firstLine.length + '\n';
        debugText += 'Starts with quote: ' + firstLine.startsWith('"') + '\n';
        debugText += 'Ends with quote: ' + firstLine.endsWith('"') + '\n';
        debugText += 'Contains tab: ' + firstLine.includes('\t') + '\n';
        debugText += 'Tab count: ' + (firstLine.match(/\t/g) || []).length + '\n\n';
        
        // Show special characters
        debugText += 'Special chars in first 100:\n';
        for (let i = 0; i < Math.min(100, firstLine.length); i++) {
          const char = firstLine[i];
          if (char === '"' || char === '\t') {
            debugText += `[${i}] = ${char === '\t' ? 'TAB' : '"'}\n`;
          }
        }
        
        document.getElementById('debugOutput').value = debugText;
      }
      
      // Process and write back
      const format = document.querySelector('input[name="format"]:checked').value;
      const cleanedText = processClipboardData(clipboardText, format);
      
      if (debugMode) {
        const currentDebug = document.getElementById('debugOutput').value;
        document.getElementById('debugOutput').value = currentDebug + '\n=== PROCESSED OUTPUT ===\n' + 
          cleanedText.substring(0, 300) + '...\n';
      }
      
      await navigator.clipboard.writeText(cleanedText);
      
      showStatus('✓ Cleaned data copied to clipboard!', 'success');
      
    } catch (err) {
      showStatus('Cannot access clipboard. Please copy cells first (Ctrl+C)', 'error');
    } finally {
      copyButton.disabled = false;
    }
  });
  
  // Process clipboard data - Fixed version
  function processClipboardData(text, format) {
    const cleanedText = removeGoogleSheetsQuotes(text);
    
    if (format === 'csv') {
      return convertToCsv(cleanedText);
    }
    
    return cleanedText;
  }
  
  // Fixed quote removal function
  function removeGoogleSheetsQuotes(text) {
    // Special handling for SQL-like content with embedded quotes
    // Pattern: text that starts without quotes but contains quoted strings within
    if (!text.startsWith('"') && text.includes('"') && text.includes("'")) {
      // This looks like SQL or similar content
      // Find and replace only the Google Sheets added quotes around multi-line values
      
      // Pattern to match quoted strings that span multiple lines
      // These are added by Google Sheets when a cell contains newlines
      const multilineQuotePattern = /"([^"]*(?:""[^"]*)*(?:\n[^"]*(?:""[^"]*)*)+)"/g;
      
      text = text.replace(multilineQuotePattern, (match, content) => {
        // Unescape double quotes
        return content.replace(/""/g, '"');
      });
      
      return text;
    }
    
    // Original processing for other formats
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      if (!line) return '';
      
      // Check if entire line is quoted (multi-line single cell)
      if (line.startsWith('"') && line.endsWith('"') && !line.includes('\t')) {
        return line.slice(1, -1).replace(/""/g, '"');
      }
      
      // Parse line character by character
      const cells = [];
      let currentCell = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        const prevChar = i > 0 ? line[i - 1] : null;
        
        // Start of quoted cell
        if (!inQuotes && char === '"' && (!prevChar || prevChar === '\t')) {
          inQuotes = true;
          i++;
          continue;
        }
        
        // Escaped quote within quoted cell
        if (inQuotes && char === '"' && nextChar === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        
        // End of quoted cell
        if (inQuotes && char === '"' && (!nextChar || nextChar === '\t')) {
          inQuotes = false;
          cells.push(currentCell);
          currentCell = '';
          i++;
          
          // Skip tab if present
          if (i < line.length && line[i] === '\t') {
            i++;
          }
          continue;
        }
        
        // Tab delimiter (not in quotes)
        if (!inQuotes && char === '\t') {
          cells.push(currentCell);
          currentCell = '';
          i++;
          continue;
        }
        
        // Regular character
        currentCell += char;
        i++;
      }
      
      // Add remaining cell
      if (currentCell || inQuotes) {
        cells.push(currentCell);
      }
      
      return cells.join('\t');
    }).join('\n');
  }
  
  // Convert TSV to CSV format
  function convertToCsv(text) {
    const lines = text.split('\n');
    
    return lines.map(line => {
      const cells = line.split('\t');
      
      return cells.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',');
    }).join('\n');
  }
  
  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 3000);
    }
  }
  
  // Load saved format preference
  chrome.storage.local.get(['format'], function(result) {
    if (result.format) {
      document.querySelector(`input[value="${result.format}"]`).checked = true;
    }
  });
  
  // Save format preference
  document.querySelectorAll('input[name="format"]').forEach(radio => {
    radio.addEventListener('change', function() {
      chrome.storage.local.set({ format: this.value });
    });
  });
  
  // Add usage instructions
  const container = document.querySelector('.container');
  const instructions = document.createElement('div');
  instructions.className = 'instructions';
  instructions.innerHTML = `
    <h3>使い方:</h3>
    <ol>
      <li>Google スプレッドシートでセルを選択</li>
      <li>Ctrl+C (Mac: Cmd+C) でコピー</li>
      <li>「Copy Selected Cells」をクリック</li>
    </ol>
    <p style="font-size: 12px; color: #666;">クリップボードのデータから不要な引用符が除去されます。</p>
  `;
  container.insertBefore(instructions, container.querySelector('.format-section'));
});