<script>
  import { onMount } from 'svelte';
  import { initializeMonaco } from '../utils/monaco.js';

  export let onUpdate = () => {};
  export let value = '';

  let divElement;
  let editor;
  let currentText = '';
  let isUpdatingFromEditor = false;

  onMount(async () => {
    try {
      const monaco = initializeMonaco();
      editor = monaco.editor.create(divElement, {
        value: value || '',
        language: 'mermaid',
        theme: 'mermaid',
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        automaticLayout: true
      });

      currentText = value || '';
      editor.onDidChangeModelContent(({ isFlush }) => {
        const newText = editor?.getValue();
        if (!newText || currentText === newText || isFlush || isUpdatingFromEditor) {
          return;
        }
        isUpdatingFromEditor = true;
        currentText = newText;
        onUpdate(currentText);
        setTimeout(() => {
          isUpdatingFromEditor = false;
        }, 0);
      });

      const resizeObserver = new ResizeObserver((entries) => {
        editor?.layout({
          height: entries[0].contentRect.height,
          width: entries[0].contentRect.width
        });
      });

      if (divElement.parentElement) {
        resizeObserver.observe(divElement);
      }

      return () => {
        resizeObserver.disconnect();
        editor?.dispose();
      };
    } catch (error) {
      console.error('Failed to load Monaco Editor:', error);
    }
  });

  export const setValue = (newValue) => {
    if (editor && newValue !== currentText) {
      currentText = newValue;
      if (!isUpdatingFromEditor) {
        const position = editor.getPosition();
        const selection = editor.getSelection();
        
        editor.setValue(newValue);
        if (position) {
          const model = editor.getModel();
          const maxLine = model.getLineCount();
          const maxColumn = model.getLineMaxColumn(Math.min(position.lineNumber, maxLine));
          
          const validPosition = {
            lineNumber: Math.min(position.lineNumber, maxLine),
            column: Math.min(position.column, maxColumn)
          };
          
          editor.setPosition(validPosition);
          
          if (selection) {
            try {
              editor.setSelection(selection);
            } catch (e) {
              editor.setPosition(validPosition);
            }
          }
        }
      } else {
        editor.setValue(newValue);
      }
    }
  };

  export const getValue = () => {
    return editor ? editor.getValue() : currentText;
  };
  
  $: if (editor && value !== currentText && value !== editor.getValue() && !isUpdatingFromEditor) {
    setValue(value);
  }
</script>

<div bind:this={divElement} class="h-full w-full"></div>
