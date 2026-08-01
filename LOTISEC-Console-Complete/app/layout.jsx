export const metadata = {
  title: "LOTISEC — Chaque minute compte",
  description: "Plateforme géodécisionnelle au service des interventions d'urgence."
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
