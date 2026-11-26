import { h } from 'https://esm.sh/preact';
import { useEffect, useRef } from 'https://esm.sh/preact/hooks';

export function SvelteEditorWrapper({ 
  component, 
  props = {}, 
  onCancel, 
  existingDiagramData, 
  isEditMode 
}) {
  const containerRef = useRef(null);
  const svelteInstanceRef = useRef(null);

  useEffect(() => {
    const loadAndMountSvelte = async () => {
      try {
        const { NoLoginEditor } = await import('/dist/svelte/editor-components.js');
        
        if (containerRef.current && component === 'NoLoginEditor') {
          svelteInstanceRef.current = new NoLoginEditor({
            target: containerRef.current,
            props: {
              onCancel,
              existingDiagramData,
              isEditMode,
              ...props
            }
          });
        }
      } catch (error) {
        console.error('Failed to load or mount Svelte component:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="padding: 20px; text-align: center;">
              <p>Loading Svelte editor failed. Please refresh and try again.</p>
              <button onclick="window.location.reload()" style="
                background-color: #007bff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 4px; 
                cursor: pointer;
              ">
                Refresh Page
              </button>
            </div>
          `;
        }
      }
    };

    loadAndMountSvelte();
    return () => {
      if (svelteInstanceRef.current) {
        try {
          svelteInstanceRef.current.$destroy();
        } catch (error) {
          console.warn('Error destroying Svelte component:', error);
        }
      }
    };
  }, [component, onCancel, existingDiagramData, isEditMode]);

  useEffect(() => {
    if (svelteInstanceRef.current) {
      try {
        svelteInstanceRef.current.$set({
          onCancel,
          existingDiagramData,
          isEditMode,
          ...props
        });
      } catch (error) {
        console.warn('Error updating Svelte component props:', error);
      }
    }
  }, [props, onCancel, existingDiagramData, isEditMode]);

  return h('div', {
    ref: containerRef,
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  });
}
