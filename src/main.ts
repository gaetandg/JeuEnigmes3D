import './style.css';
import { Game } from './game/Game.ts';
import { exposeDebugApi } from './debug/api.ts';

const params = new URLSearchParams(window.location.search);
const test = params.has('test');

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const ui = document.querySelector<HTMLElement>('#ui')!;

try {
  const game = new Game({ canvas, ui, test });
  if (test || params.has('debug')) exposeDebugApi(game);
  game.start();
} catch (e) {
  console.error(e);
  ui.innerHTML = `<div class="overlay"><div class="panel"><h1>Lueur</h1>
    <p>Impossible de démarrer le jeu sur ce navigateur (WebGL indisponible ?).</p></div></div>`;
}
