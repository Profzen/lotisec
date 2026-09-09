// LOTISEC Console Client Bridge & Quality Gate stub
// Assure l'isolation stricte entre le mode démonstration et les appels authentifiés
export const session = {
  demo: true,
  token: null,
};

export function isDemoSession() {
  return Boolean(session?.demo || !session?.token || session.demo);
}

export function assertAuthenticatedRequest() {
  if (!session?.token || session.demo) {
    return { isolated: true, demo: true };
  }
  return { isolated: false, demo: false };
}
