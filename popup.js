// Improved popup script for Copy Clean for Sheets
// Better handling of multi-line cells

document.addEventListener('DOMContentLoaded', function() {
  const copyButton = document.getElementById('copyButton');
  const statusDiv = document.getElementById('status');
  
  // Copy button click handler
  copyButton.addEventListener('click', async function() {
    try {
      copyButton.disabled = true;
      showStatus('Processing...', 'info');
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a Google Sheets page
      if (!tab.url || !tab.url.includes('docs.google.com/spreadsheets')) {
        showStatus('Please open a Google Sheets document', 'error');
        copyButton.disabled = false;
        return;
      }
      
      // Read from clipboard
      try {
        const clipboardText = await navigator.clipboard.readText();
        console.log('Read from clipboard:', clipboardText);
        
        if (!clipboardText) {
          showStatus('No data in clipboard. Please copy cells first (Ctrl+C)', 'error');
          copyButton.disabled = false;
          return;
        }
        
        // Get selected format
        const format = document.querySelector('input[name="format"]:checked').value;
        
        // Process the clipboard data
        const cleanedText = processClipboardData(clipboardText, format);
        console.log('Cleaned text:', cleanedText);
        
        // Write back to clipboard
        await navigator.clipboard.writeText(cleanedText);
        
        showStatus('✓ Cleaned data copied to clipboard!', 'success');
        
      } catch (err) {
        console.error('Clipboard error:', err);
        showStatus('Cannot access clipboard. Please copy cells first (Ctrl+C)', 'error');
      }
      
      copyButton.disabled = false;
      
    } catch (error) {
      showStatus('An error occurred', 'error');
      console.error('Error:', error);
      copyButton.disabled = false;
    }
  });
  
  // Process clipboard data to remove quotes and format as requested
  function processClipboardData(text, format) {
    console.log('Processing clipboard data...');
    console.log('Raw length:', text.length);
    
    // Special handling for complex multi-line cells
    const result = processComplexCells(text);
    
    // Format output based on selected format
    if (format === 'csv') {
      // Convert TSV to CSV if needed
      return result.split('\t').join(',');
    }
    
    return result;
  }
  
  function processComplexCells(text) {
    // This function handles the case where cells contain multi-line text
    // Google Sheets formats it as: "line1\nline2\nline3"\t"another cell"
    
    const cells = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (!inQuotes && char === '"') {
        // Starting a quoted cell
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
        cells.push(currentCell);
        currentCell = '';
        i++;
        
        // Skip the delimiter if it exists
        if (i < text.length && (text[i] === '\t' || text[i] === '\n')) {
          if (text[i] === '\n') {
            // End of row, add newline to result
            cells.push('\n');
          } else {
            // Tab separator between cells
            cells.push('\t');
          }
          i++;
        }
        continue;
      }
      
      if (!inQuotes && (char === '\t' || char === '\n')) {
        // Unquoted cell delimiter
        if (currentCell) {
          cells.push(currentCell);
          currentCell = '';
        }
        cells.push(char);
        i++;
        continue;
      }
      
      // Regular character
      currentCell += char;
      i++;
    }
    
    // Add any remaining cell
    if (currentCell) {
      cells.push(currentCell);
    }
    
    // Join the cells back together
    return cells.join('');
  }
  
  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-hide success messages after 3 seconds
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
  
  // Save format preference when changed
  document.querySelectorAll('input[name="format"]').forEach(radio => {
    radio.addEventListener('change', function() {
      chrome.storage.local.set({ format: this.value });
    });
  });
  
  // Update instructions
  const container = document.querySelector('.container');
  const instructions = document.createElement('div');
  instructions.className = 'instructions';
  instructions.innerHTML = `
    <h3>How to use:</h3>
    <ol>
      <li>Select cells in Google Sheets</li>
      <li>Copy with Ctrl+C (or Cmd+C)</li>
      <li>Click "Copy Selected Cells"</li>
    </ol>
    <p style="font-size: 12px; color: #666;">The extension will clean the copied data and put it back in your clipboard.</p>
  `;
  container.insertBefore(instructions, container.querySelector('.format-section'));
});