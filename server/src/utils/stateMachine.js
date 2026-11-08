export const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'], ready: ['served'], served: ['completed'], completed: [], cancelled: [],
};
export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
export const KITCHEN_ALLOWED = ['preparing', 'ready'];
