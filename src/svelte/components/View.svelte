<script>
  import { onMount } from 'svelte';
  import mermaidModule from '@mermaid-chart/mermaid';
  import layouts from '@mermaid-chart/layout-elk';

  export let code = '';
  export let shouldShowGrid = false;
  export let theme = 'default';
  export let onError = () => {}; 
   let lastValidSvg = ''; 
  $: isDarkTheme = ['neo-dark', 'dark', 'redux-dark'].includes(theme);

  let container;
  let svg = '';
  let error = false;
  let errorMessage = ''; 
  let isRendering = false;

    export async function initializeMermaid() {
      try {
        mermaidModule.registerLayoutLoaders(layouts);

        await mermaidModule.registerIconPacks([
          {
            name: 'fa',

            loader: () => import('@iconify-json/fa6-solid').then((m) => m.icons),
          },
          {
            name: 'far',
            loader: () => import('@iconify-json/fa6-regular').then((m) => m.icons),
          },
          {
            name: 'fas',
            loader: () => import('@iconify-json/fa6-solid').then((m) => m.icons),
          },
          {
            name: 'fab',
            loader: () => import('@iconify-json/fa6-brands').then((m) => m.icons),
          },
          {
            name: 'aws',
            loader: () => import('@mermaid-chart/icons-aws').then((m) => m.icons),
          },
          {
            name: 'azure',
            loader: () => import('@mermaid-chart/icons-azure').then((m) => m.icons),
          },
          {
            name: 'gcp',
            loader: () => import('@mermaid-chart/icons-gcp').then((m) => m.icons),
          },
          {
            name: 'logos',
            loader: () => import('@iconify-json/logos').then((module) => module.icons),
          },
          {
            name: 'mdi',
            loader: () => import('@iconify-json/mdi').then((module) => module.icons),
          },
        ]);
        
        await mermaidModule.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: theme || 'default',
          fontFamily: 'Recursive, sans-serif'
        });
        
        console.log('Mermaid View component initialized successfully with icon packs');
      } catch (error) {
        console.error('Error initializing Mermaid in View component:', error);
      }
    }

  const renderDiagram = async (diagramCode) => {
    if (!diagramCode || !diagramCode.trim()) {
      svg = '';
      lastValidSvg = '';
      error = false;
      errorMessage = '';
      onError(null); 
      return;
    }

    isRendering = true;
    error = false;

    try {
      await initializeMermaid();
      const result = await mermaidModule.render('diagram-' + Date.now(), diagramCode);
      svg = result.svg;
      lastValidSvg = result.svg; 
      errorMessage = ''; 
      onError(null); 
    } catch (err) {
      console.error('Error rendering diagram:', err);
       if (!lastValidSvg) {
        svg = '';
      }
      error = true;
      svg = '';
      errorMessage = err.message || err.toString();
      console.log('Passing error to parent:', errorMessage); // Debug log
      onError(errorMessage); 
    } finally {
      isRendering = false;
    }
  };

  $: if (code || theme) {
    renderDiagram(code);
  }


  onMount(() => {
    if (code) {
      renderDiagram(code);
    }
  });
</script>

<div
  class="h-full w-full relative {shouldShowGrid ? (isDarkTheme ? 'grid-bg-dark' : 'grid-bg-light') : ''} {error ? 'opacity-50' : ''}"
  style="background-color: {isDarkTheme ? '#16141f' : 'transparent'}"
  bind:this={container}
>


  <div class="h-full overflow-auto">
    {#if isRendering}
      <div class="flex h-full items-center justify-center text-muted-foreground">
        Rendering diagram...
      </div>
     {:else if error && lastValidSvg}
      <div class="flex h-full items-center justify-center p-4 " style="filter: opacity(0.5);">
        {@html lastValidSvg}
      </div>
    {:else if error}
     <div class="flex h-full items-center justify-center" style="color: {isDarkTheme ? '#ffffff' : '#6b7280'}"></div>
    {:else if svg}
      <div class="flex h-full items-center justify-center p-4 exclude-global">
        {@html svg}
      </div>
    {:else}
      <div class="flex h-full items-center justify-center" style="color: {isDarkTheme ? '#ffffff' : '#6b7280'}">Enter Mermaid code to see the diagram</div>
    {/if}
  </div>
</div>





