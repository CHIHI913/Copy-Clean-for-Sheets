// Popup script for Copy Clean for Sheets

document.addEventListener('DOMContentLoaded', function() {
  const copyButton = document.getElementById('copyButton');
  const statusDiv = document.getElementById('status');
  
  // Copy button click handler
  copyButton.addEventListener('click', async function() {
    try {
      copyButton.disabled = true;
      showStatus('Copying...', 'info');
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a Google Sheets page
      if (!tab.url || !tab.url.includes('docs.google.com/spreadsheets')) {
        showStatus('Please open a Google Sheets document', 'error');
        copyButton.disabled = false;
        return;
      }
      
      // Send message to content script to get selected cells
      chrome.tabs.sendMessage(tab.id, { action: 'getSelectedCells' }, async function(response) {
        if (chrome.runtime.lastError) {
          showStatus('Error: Unable to access the page. Please refresh and try again.', 'error');
          copyButton.disabled = false;
          return;
        }
        
        if (!response || !response.data) {
          showStatus('No cells selected. Please select cells and try again.', 'error');
          copyButton.disabled = false;
          return;
        }
        
        // Get selected format
        const format = document.querySelector('input[name="format"]:checked').value;
        
        // Convert data to text
        const text = convertToText(response.data, format);
        
        // Copy to clipboard
        try {
          await copyToClipboard(text);
          showStatus('✓ Copied to clipboard!', 'success');
        } catch (err) {
          showStatus('Failed to copy to clipboard', 'error');
          console.error('Clipboard error:', err);
        }
        
        copyButton.disabled = false;
      });
      
    } catch (error) {
      showStatus('An error occurred', 'error');
      console.error('Error:', error);
      copyButton.disabled = false;
    }
  });
  
  // Convert cell data to text format
  function convertToText(data, format) {
    const separator = format === 'csv' ? ',' : '\t';
    
    return data.map(row => {
      return row.map(cell => {
        // For CSV format, escape values containing comma, quotes, or newlines
        if (format === 'csv' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
          // Escape quotes by doubling them
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');
  }
  
  // Copy text to clipboard using Chrome API
  async function copyToClipboard(text) {
    // Try using the Chrome clipboard API first
    if (chrome.clipboard && chrome.clipboard.writeText) {
      await chrome.clipboard.writeText(text);
    } else {
      // Fallback method using textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
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
});