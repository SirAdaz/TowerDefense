// Sous-ensemble latin seul (le français y est entier), servi avec le jeu : aucun appel externe.
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./style.css";
import { startApp } from "./ui/app.ts";
import { browserStore } from "./ui/storage.ts";

startApp(browserStore());
