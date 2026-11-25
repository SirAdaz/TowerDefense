import "./style.css";
import { browserStore } from "../shared/storage.ts";
import { startApp } from "./ui/app.ts";
import { exposeDevTools } from "./ui/devTools.ts";

const app = startApp(browserStore());

if (import.meta.env.DEV) {
  exposeDevTools(app);
}
