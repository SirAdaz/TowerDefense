import "./home.css";
import { browserStore } from "../shared/storage.ts";
import { GAME_RECORDS } from "./records.ts";

const store = browserStore();

for (const gameRecord of GAME_RECORDS) {
  const recordLine = document.querySelector<HTMLElement>(`[data-record="${gameRecord.gameId}"]`);
  const recordText = gameRecord.describe(store);
  if (recordLine !== null && recordText !== null) {
    recordLine.textContent = recordText;
    recordLine.hidden = false;
  }
}
