import "./style.css";
import { browserStore } from "../shared/storage.ts";
import { openChessStore } from "./data/store.ts";
import { startApp } from "./ui/app.ts";

startApp(browserStore(), await openChessStore());
