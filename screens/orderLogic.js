// orderLogic.js — order statuses shared by the app and the database (pure, no React)

export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];

const LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const statusLabel = (status) => LABELS[status] || status;