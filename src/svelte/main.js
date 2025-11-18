import '../styles/tailwind.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@fontsource/recursive/300.css';
import '@fontsource/recursive/400.css';
import '@fontsource/recursive/500.css';
import '@fontsource/recursive/600.css';
import '@fontsource/recursive/700.css';
import NoLoginEditor from './components/NoLoginEditor.svelte';
import Card from './components/Card.svelte';
import Editor from './components/Editor.svelte';
import View from './components/View.svelte';
import Preset from './components/Preset.svelte';
import DesktopEditor from './components/DesktopEditor.svelte';

export { 
  NoLoginEditor, 
  Card, 
  Editor, 
  View, 
  Preset, 
  DesktopEditor,
};

if (typeof window !== 'undefined') {
  window.SvelteComponents = {
    NoLoginEditor,
    Card,
    Editor,
    View,
    Preset,
    DesktopEditor,
  };
}
