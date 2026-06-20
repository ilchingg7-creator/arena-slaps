import "./styles.css";
import { createGame } from "./game/createGame";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount point");
}

createGame(app);
