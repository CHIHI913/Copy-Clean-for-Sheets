// Content script for Copy Clean for Sheets
// This script runs on Google Sheets pages and extracts selected cell data

// Function to get selected cells data from Google Sheets
function getSelectedCellsData() {
  try {
    // Find all selected cells (they have the class 's5')
    const selectedCells = document.querySelectorAll('.s5');
    
    if (selectedCells.length === 0) {
      // Alternative method: try to find cells with aria-selected="true"
      const altSelectedCells = document.querySelectorAll('[aria-selected="true"]');
      if (altSelectedCells.length === 0) {
        return null;
      }
      return extractCellData(altSelectedCells);
    }
    
    return extractCellData(selectedCells);
  } catch (error) {
    console.error('Error getting selected cells:', error);
    return null;
  }
}

// Extract data from cells
function extractCellData(cells) {
  const cellsData = [];
  const cellMap = new Map();
  
  // Process each selected cell
  cells.forEach(cell => {
    // Get row and column indices
    const row = parseInt(cell.getAttribute('data-row-index') || cell.getAttribute('aria-rowindex')) || 0;
    const col = parseInt(cell.getAttribute('data-col-index') || cell.getAttribute('aria-colindex')) || 0;
    
    // Get cell value
    let value = '';
    
    // Try different methods to get cell value
    const cellInput = cell.querySelector('input');
    if (cellInput) {
      value = cellInput.value;
    } else {
      // Look for the text content in various elements
      const textElement = cell.querySelector('.cell-input') || 
                         cell.querySelector('.waffle-cell-text') ||
                         cell.querySelector('[role="textbox"]') ||
                         cell;
      value = textElement.textContent || textElement.innerText || '';
    }
    
    // Store in map with row-col as key
    const key = `${row}-${col}`;
    cellMap.set(key, { row, col, value: value.trim() });
  });
  
  // Convert map to sorted array
  const sortedCells = Array.from(cellMap.values()).sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  
  // Group by rows
  const rows = [];
  let currentRow = -1;
  let currentRowData = [];
  
  sortedCells.forEach(cell => {
    if (cell.row !== currentRow) {
      if (currentRowData.length > 0) {
        rows.push(currentRowData);
      }
      currentRow = cell.row;
      currentRowData = [cell.value];
    } else {
      // Fill empty columns
      const expectedCol = currentRowData.length;
      const actualCol = cell.col - (sortedCells.find(c => c.row === currentRow).col);
      
      while (currentRowData.length < actualCol) {
        currentRowData.push('');
      }
      
      currentRowData.push(cell.value);
    }
  });
  
  if (currentRowData.length > 0) {
    rows.push(currentRowData);
  }
  
  return rows.length > 0 ? rows : null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedCells') {
    const data = getSelectedCellsData();
    sendResponse({ data: data });
  }
  return true; // Keep the message channel open for async response
});