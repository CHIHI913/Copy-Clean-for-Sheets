// Copy Clean for Sheets - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const copyButton = document.getElementById('copyButton');
  const statusDiv = document.getElementById('status');
  
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
      
      // Process and write back
      const format = document.querySelector('input[name="format"]:checked').value;
      const cleanedText = processClipboardData(clipboardText, format);
      await navigator.clipboard.writeText(cleanedText);
      
      showStatus('✓ Cleaned data copied to clipboard!', 'success');
      
    } catch (err) {
      showStatus('Cannot access clipboard. Please copy cells first (Ctrl+C)', 'error');
    } finally {
      copyButton.disabled = false;
    }
  });
  
  // Process clipboard data
  function processClipboardData(text, format) {
    const cleanedText = removeGoogleSheetsQuotes(text);
    
    // Convert to CSV format if requested
    if (format === 'csv') {
      return convertToCsv(cleanedText);
    }
    
    return cleanedText;
  }
  
  // Remove quotes added by Google Sheets while preserving original quotes
  function removeGoogleSheetsQuotes(text) {
    const result = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (!inQuotes && char === '"') {
        // Start of quoted cell
        inQuotes = true;
        i++;
        continue;
      }
      
      if (inQuotes && char === '"' && nextChar === '"') {
        // Escaped quote within cell
        currentCell += '"';
        i += 2;
        continue;
      }
      
      if (inQuotes && char === '"' && (nextChar === '\t' || nextChar === '\n' || i === text.length - 1)) {
        // End of quoted cell
        inQuotes = false;
        result.push(currentCell);
        currentCell = '';
        i++;
        
        // Add delimiter if present
        if (i < text.length && (text[i] === '\t' || text[i] === '\n')) {
          result.push(text[i]);
          i++;
        }
        continue;
      }
      
      if (!inQuotes && (char === '\t' || char === '\n')) {
        // Cell delimiter
        if (currentCell) {
          result.push(currentCell);
          currentCell = '';
        }
        result.push(char);
        i++;
        continue;
      }
      
      // Regular character
      currentCell += char;
      i++;
    }
    
    // Add any remaining content
    if (currentCell) {
      result.push(currentCell);
    }
    
    return result.join('');
  }
  
  // Convert TSV to CSV format
  function convertToCsv(text) {
    const lines = text.split('\n');
    
    return lines.map(line => {
      const cells = line.split('\t');
      
      return cells.map(cell => {
        // Quote cells that contain comma, quote, or newline
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