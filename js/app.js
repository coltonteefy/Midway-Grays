const CLASS_NAMES = {
  HIDDEN: 'hidden',
  CARD: 'bg-gray-700 p-6 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105',
};

function sanitizeInput(input) {
  return input.replace(/[<>&"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[char]));
}

async function fetchData() {
  const dataContainer = document.getElementById('data-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.classList.remove(CLASS_NAMES.HIDDEN);
  
  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    // ... rest of fetchData logic ...
  } catch (error) {
    dataContainer.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
  } finally {
    loadingIndicator.classList.add(CLASS_NAMES.HIDDEN);
  }
}

document.getElementById('search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filteredData = productData.filter(product => product.name.toLowerCase().includes(query));
  renderCards(filteredData);
});

// Initialize
try {
  fetchData();
  setInterval(fetchData, REFRESH_INTERVAL_MINUTES * 60 * 1000);
} catch (error) {
  document.getElementById('data-container').innerHTML = '<p class="text-red-500">An unexpected error occurred.</p>';
}
