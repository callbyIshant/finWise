const API_BASE_URL = 'http://localhost:8001/api/v1';

// Format currency as ₹ (Indian Rupee)
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
}
