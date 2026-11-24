// Sous-ensemble latin seul (le français y est entier), servi avec le jeu : aucun appel à Google Fonts.
import "@fontsource/press-start-2p/latin-400.css";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  root.textContent = "Tower defense";
}
