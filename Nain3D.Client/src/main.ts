import { createApp } from 'vue';
import App from './App.vue';
import { initLang } from './i18n';
import { registerWorker } from './pwa/register';
import { parseUrlState } from './state/urlState';
import './style.css';

initLang();

const recording = parseUrlState(window.location.search).mode === 'record';
registerWorker(recording);

// The NainDev ecosystem bar is page chrome: it is not loaded in recording mode.
if (!recording) {
  const bar = document.createElement('nain-ecosystem-bar');
  bar.setAttribute('current-project', 'Nain3D');
  document.body.prepend(bar);
  const script = document.createElement('script');
  script.src = 'https://www.naindev.com/assets/js/ecosystem-bar.js?v=2.1.0';
  script.defer = true;
  document.head.appendChild(script);
}

createApp(App).mount('#app');
