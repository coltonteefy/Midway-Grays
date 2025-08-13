console.log('app.js loaded successfully at', new Date().toISOString());

const CLASS_NAMES = {
  HIDDEN: 'hidden',
  CARD: 'bg-gray-700 p-6 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105',
};

const SPREADSHEET_URL = 'YOUR_SPREADSHEET_URL_HERE'; // Replace with your Google Sheet CSV URL
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE'; // Replace with your Apps Script URL
const REFRESH_INTERVAL_MINUTES = 2;
let productData = [];

async function fetchData() {
  const dataContainer = document.getElementById('data-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const refreshInfo = document.getElementById('refresh-info');
  loadingIndicator.classList.remove(CLASS_NAMES.HIDDEN);
  dataContainer.innerHTML = '';

  if (!SPREADSHEET_URL || SPREADSHEET_URL.includes('YOUR_SPREADSHEET_URL_HERE')) {
    dataContainer.innerHTML = '<p class="text-red-500">Error: Invalid SPREADSHEET_URL. Please configure the Google Sheet CSV URL.</p>';
    loadingIndicator.classList.add(CLASS_NAMES.HIDDEN);
    return;
  }

  try {
    console.log('Fetching data from:', SPREADSHEET_URL);
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    console.log('CSV data received:', csvText.substring(0, 100));
    const rows = csvText.split('\n').map(row => row.split(','));
    const headers = rows[0].map(h => h.trim().replace(/"/g, ''));
    const dataRows = rows.slice(1).filter(row => row.length > 1 && row[0].trim().replace(/"/g, '') !== '');

    const columnMap = {
      productName: headers.findIndex(h => h.toLowerCase() === 'product name'),
      inventory: headers.findIndex(h => h.toLowerCase() === 'inventory'),
      price: headers.findIndex(h => h.toLowerCase() === 'price'),
      resale: headers.findIndex(h => h.toLowerCase() === 'resale'),
    };

    if (Object.values(columnMap).some(index => index === -1)) {
      throw new Error('Missing required columns in spreadsheet (Product Name, Inventory, Price, Resale)');
    }

    productData = dataRows
      .filter(row => {
        const inventory = parseInt(row[columnMap.inventory]?.trim().replace(/"/g, '')) || 0;
        const resale = row[columnMap.resale]?.trim().toLowerCase().replace(/"/g, '') || '';
        return inventory > 0 && resale !== 'false';
      })
      .map(row => ({
        name: row[columnMap.productName].trim().replace(/"/g, ''),
        inventory: parseInt(row[columnMap.inventory].trim().replace(/"/g, '')),
        price: parseFloat(row[columnMap.price].trim().replace('$', '')),
      }));

    renderCards(productData);
    refreshInfo.textContent = `Last updated: ${new Date().toLocaleTimeString()} | Next refresh in ${REFRESH_INTERVAL_MINUTES} minutes.`;
  } catch (error) {
    console.error('Fetch error:', error);
    dataContainer.innerHTML = `<p class="text-red-500">Error loading products: ${error.message}. Check SPREADSHEET_URL.</p>`;
  } finally {
    loadingIndicator.classList.add(CLASS_NAMES.HIDDEN);
  }
}

function renderCards(products) {
  const dataContainer = document.getElementById('data-container');
  dataContainer.innerHTML = products.length === 0 ? '<p class="col-span-full text-center text-gray-500">No products available.</p>' : '';

  products.forEach((product, index) => {
    const priceText = isNaN(product.price) ? 'Price not available' : `$${product.price.toFixed(2)}`;
    const card = document.createElement('div');
    card.className = CLASS_NAMES.CARD;
    card.innerHTML = `
      <h3 class="text-xl font-semibold text-white mb-2">${product.name}</h3>
      <p class="text-gray-400 mb-2">Inventory: <span class="font-medium text-gray-200">${product.inventory}</span></p>
      <div class="flex items-center justify-between mt-4">
        <p class="text-lg font-bold text-indigo-400 price-per-unit" data-price="${product.price}">${priceText}</p>
        <div class="flex items-center space-x-2">
          <span class="text-gray-400">Quantity:</span>
          <button class="quantity-btn p-1 rounded-full bg-gray-600 text-white hover:bg-gray-500" data-action="decrement" data-product-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="text-white text-lg font-bold w-6 text-center quantity-display" data-product-index="${index}">0</span>
          <button class="quantity-btn p-1 rounded-full bg-gray-600 text-white hover:bg-gray-500" data-action="increment" data-product-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    `;
    dataContainer.appendChild(card);
  });

  document.getElementById('total-cost').textContent = '$0.00';
}

document.getElementById('data-container').addEventListener('click', (event) => {
  const button = event.target.closest('.quantity-btn');
  if (!button) return;
  const action = button.dataset.action;
  const productIndex = button.dataset.productIndex;
  const card = button.closest('.bg-gray-700');
  const quantityDisplay = card.querySelector(`.quantity-display[data-product-index="${productIndex}"]`);
  const maxInventory = parseInt(productData[productIndex].inventory) || 0;
  let currentQuantity = parseInt(quantityDisplay.textContent);

  if (action === 'increment' && currentQuantity < maxInventory) {
    currentQuantity++;
  } else if (action === 'decrement' && currentQuantity > 0) {
    currentQuantity--;
  }
  quantityDisplay.textContent = currentQuantity;
  updateTotalCost();
});

function updateTotalCost() {
  let total = 0;
  let orderItems = [];
  const cards = document.getElementById('data-container').querySelectorAll('div.bg-gray-700');

  cards.forEach((card, index) => {
    const quantityDisplay = card.querySelector('.quantity-display');
    const priceElement = card.querySelector('.price-per-unit');
    if (quantityDisplay && priceElement) {
      const quantity = parseInt(quantityDisplay.textContent) || 0;
      const price = parseFloat(priceElement.dataset.price);
      if (!isNaN(price) && quantity > 0) {
        total += price * quantity;
        orderItems.push({
          name: productData[index].name,
          price: price,
          quantity: quantity
        });
      }
    }
  });

  document.getElementById('total-cost').textContent = `$${total.toFixed(2)}`;
  updateOrderSummary(orderItems, total);

  const orderSection = document.getElementById('order-section');
  if (total > 0) {
    orderSection.classList.remove(CLASS_NAMES.HIDDEN);
  } else {
    orderSection.classList.add(CLASS_NAMES.HIDDEN);
  }
}

function updateOrderSummary(items, total) {
  const orderSummaryList = document.getElementById('order-summary-list');
  orderSummaryList.innerHTML = '';
  items.forEach(item => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    const listItem = document.createElement('div');
    listItem.className = 'flex justify-between items-center text-gray-300';
    listItem.innerHTML = `
      <span>${item.name} (x${item.quantity})</span>
      <span class="font-medium">$${itemTotal}</span>
    `;
    orderSummaryList.appendChild(listItem);
  });
  document.getElementById('order-subtotal').textContent = `$${total.toFixed(2)}`;
}

function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const randomString = Math.random().toString(36).substr(2, 5);
  return `ORDER-${timestamp}-${randomString.toUpperCase()}`;
}

function saveOrderToLocalStorage(items, email, orderId, total) {
  let pastOrders = JSON.parse(localStorage.getItem('pastOrders')) || [];
  const newOrder = {
    orderId: orderId,
    timestamp: new Date().toISOString(),
    email: email,
    items: items,
    total: total.toFixed(2)
  };
  pastOrders.push(newOrder);
  localStorage.setItem('pastOrders', JSON.stringify(pastOrders));
  console.log('Order saved:', newOrder);
}

document.getElementById('order-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    document.getElementById('confirmation-message').textContent = 'Error: Please set APPS_SCRIPT_URL in app.js';
    document.getElementById('confirmation-message').classList.add('text-red-400', 'block');
    return;
  }

  const email = document.getElementById('email-input').value.trim();
  const orderItems = [];
  let total = 0;
  const cards = document.getElementById('data-container').querySelectorAll('div.bg-gray-700');

  cards.forEach((card, index) => {
    const quantityDisplay = card.querySelector('.quantity-display');
    if (quantityDisplay && parseInt(quantityDisplay.textContent) > 0) {
      const price = parseFloat(card.querySelector('.price-per-unit').dataset.price);
      const quantity = parseInt(quantityDisplay.textContent);
      const itemTotal = price * quantity;
      orderItems.push({
        name: productData[index].name,
        quantity: quantity,
        price: price,
        itemTotal: itemTotal.toFixed(2)
      });
      total += itemTotal;
    }
  });

  if (orderItems.length === 0 || !email) {
    document.getElementById('confirmation-message').textContent = 'Please select at least one item and provide an email.';
    document.getElementById('confirmation-message').classList.add('text-red-400', 'block');
    return;
  }

  const orderId = generateOrderId();
  const payload = { items: orderItems, email: email, orderId: orderId };
  console.log('Submitting order to:', APPS_SCRIPT_URL, payload);

  try {
    document.getElementById('submit-button').textContent = 'Submitting...';
    document.getElementById('submit-button').disabled = true;
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(JSON.stringify(payload))}`
    });
    if (!response.ok) throw new Error(`Apps Script error: ${await response.text()}`);
    saveOrderToLocalStorage(orderItems, email, orderId, total);
    document.getElementById('modal-order-id').textContent = orderId;
    document.getElementById('confirmation-modal').classList.remove(CLASS_NAMES.HIDDEN);
  } catch (error) {
    console.error('Order submission error:', error);
    document.getElementById('confirmation-message').textContent = `Error submitting order: ${error.message}`;
    document.getElementById('confirmation-message').classList.add('text-red-400', 'block');
  } finally {
    document.getElementById('submit-button').textContent = 'Submit Order';
    document.getElementById('submit-button').disabled = false;
  }
});

document.getElementById('modal-close-button').addEventListener('click', () => {
  document.getElementById('confirmation-modal').classList.add(CLASS_NAMES.HIDDEN);
  window.location.reload();
});

document.getElementById('past-orders-button').addEventListener('click', () => {
  renderPastOrders();
  document.getElementById('past-orders-modal').classList.remove(CLASS_NAMES.HIDDEN);
});

document.getElementById('close-past-orders').addEventListener('click', () => {
  document.getElementById('past-orders-modal').classList.add(CLASS_NAMES.HIDDEN);
});

document.getElementById('clear-orders-button').addEventListener('click', () => {
  localStorage.removeItem('pastOrders');
  renderPastOrders();
});

function renderPastOrders() {
  const pastOrders = JSON.parse(localStorage.getItem('pastOrders')) || [];
  const pastOrdersList = document.getElementById('past-orders-list');
  pastOrdersList.innerHTML = pastOrders.length === 0 ? '<p class="text-gray-500 text-center">No past orders found.</p>' : '';

  pastOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(order => {
    const orderDate = new Date(order.timestamp).toLocaleString();
    const orderCard = document.createElement('div');
    orderCard.className = 'bg-gray-700 p-4 rounded-lg shadow-md';
    orderCard.innerHTML = `
      <h4 class="font-bold text-white mb-1">Order ID: <span class="text-indigo-400">${order.orderId}</span></h4>
      <p class="text-gray-400 text-sm">Date: ${orderDate}</p>
      <p class="text-gray-400 text-sm mb-2">Email: ${order.email}</p>
      <ul class="list-disc list-inside text-gray-300 text-sm">
        ${order.items.map(item => `<li>${item.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
      </ul>
      <div class="mt-2 text-right font-bold text-lg text-white">Total: <span class="text-indigo-400">$${order.total}</span></div>
    `;
    pastOrdersList.appendChild(orderCard);
  });
}

try {
  fetchData();
  setInterval(fetchData, REFRESH_INTERVAL_MINUTES * 60 * 1000);
} catch (error) {
  console.error('Application error:', error);
  document.getElementById('data-container').innerHTML = '<p class="text-red-500">Unexpected error. Please try again later.</p>';
}
