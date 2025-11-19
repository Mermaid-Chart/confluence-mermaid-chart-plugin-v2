<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import mermaidModule from '@mermaid-chart/mermaid';
  import { generatePngFromMermaid } from '../utils/exportUtils.js';
  import Card from './Card.svelte';
  import Editor from './Editor.svelte';
  import View from './View.svelte';
  import Preset from './Preset.svelte';
  import Select from './Select.svelte';
  import CodeSvgIcon from './CodeSvgIcon.svelte';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  export const onCancel = () => {};
  export let existingDiagramData = null;
  export let isEditMode = false;

  const DEFAULT_DIAGRAM = '';

  let code = existingDiagramData?.diagramCode || DEFAULT_DIAGRAM;
  let svg = '';
  let isRendering = false;
  let size = existingDiagramData?.size || 'medium';
  let caption = existingDiagramData?.caption || '';
  let theme = existingDiagramData?.theme || 'default';
  let error = null;
  let renderError = null; 
  let isDataLoaded = !!existingDiagramData?.diagramCode;

  let editorMode = 'code';
  let editorComponent;

  let samplePanelOpen = true;

  let showThemeDropdown = false;
  const MERMAID_THEMES = [
    { id: 'mc', name: 'Mermaid Chart' },
    { id: 'neo', name: 'Neo' },
    { id: 'neo-dark', name: 'Neo Dark' },
    { id: 'default', name: 'Default' },
    { id: 'forest', name: 'Forest' },
    { id: 'base', name: 'Base' },
    { id: 'dark', name: 'Dark' },
    { id: 'neutral', name: 'Neutral' },
    { id: 'redux', name: 'Redux' },
    { id: 'redux-dark', name: 'Redux Dark' },
  ];

  let themeButtonRef;
  let themeDropdownPosition = { top: '120px', right: 'calc(70% + 20px)' };

  const dispatch = createEventDispatcher();

  const editorTabs = [
    {
      id: 'code',
      title: "",
      icon: ""
    },
    
  ];

  const tabSelectHandler = (tab) => {
    editorMode = tab.id;
  };
  export async function initializeMermaid() {
      try {
          await mermaidModule.registerLayoutLoaders(layouts);
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
      } catch (error) {
        console.error('Error initializing Mermaid:', error);
      }
    }
  onMount(async () => {
     await initializeMermaid();
    let dataLoaded = false;
    
    if (existingDiagramData && existingDiagramData.diagramCode) {
      code = existingDiagramData.diagramCode;
      if (existingDiagramData.size) size = existingDiagramData.size;
      if (existingDiagramData.caption) caption = existingDiagramData.caption;
      if (existingDiagramData.theme) theme = existingDiagramData.theme;
      
      isEditMode = true;
      isDataLoaded = true;
      dataLoaded = true;
  
      setTimeout(() => {
        if (editorComponent) {
          editorComponent.setValue(existingDiagramData.diagramCode);
        }
      }, 100);
    }

    if (!dataLoaded && window.AP && window.AP.confluence) {
      window.AP.confluence.getMacroData((data) => {       
        if (data && data.diagramCode && typeof data.diagramCode === 'string') {
          if (data.diagramType === 'mermaid') {
            code = data.diagramCode;
            isEditMode = true;
            isDataLoaded = true;
            setTimeout(() => {
              if (editorComponent) {
                editorComponent.setValue(data.diagramCode);
              }
            }, 100);
          }
        }
        
        if (data.size) size = data.size;
        if (data.caption) caption = data.caption;
        if (data.theme) theme = data.theme;
      });
    }
    if (!isEditMode && !isDataLoaded && !code) {
      code = DEFAULT_DIAGRAM;
      setTimeout(() => {
        if (editorComponent) {
          editorComponent.setValue(DEFAULT_DIAGRAM);
        }
      }, 100);
    }
  });

  async function handleInsert() {
    if (isRendering) return;
    
    try {
      if (!window.AP || !window.AP.confluence) {
        throw new Error("Confluence API is not available");
      }

      const currentCode = editorComponent ? editorComponent.getValue() : code;
      
      if (!currentCode || currentCode.trim() === '') {
        throw new Error("Diagram code cannot be empty");
      }
      
      if (!size) {
        throw new Error("Please select a diagram size");
      }

      isRendering = true;
      error = null;
      const renderResult = await mermaidModule.render('diagram-' + Date.now(), currentCode);
      
      if (!renderResult || !renderResult.svg) {
        throw new Error("Failed to render diagram");
      }
      const pngBase64 = await generatePngFromMermaid(renderResult, '#ffffff', size);
      const macroParams = {
        diagramCode: currentCode,
        size: size,
        caption: caption || '',
        theme: theme || 'default',
        diagramType: 'mermaid',
        lastEdited: new Date().toISOString(),
        isEditable: true
      };
      await window.AP.confluence.saveMacro(macroParams, pngBase64);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      window.AP.confluence.closeMacroEditor();
      
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'inserting'} diagram:`, err);
      error = `Error ${isEditMode ? 'updating' : 'inserting'} diagram: ` + err.message;
    } finally {
      isRendering = false;
    }
  }

  function handleCodeChange(newCode) {
    code = newCode;
  }

  function handleRenderError(errorMsg) {
    renderError = errorMsg;

    if (errorMsg && samplePanelOpen) {
      samplePanelOpen = false;

    }
    else if (!errorMsg && !samplePanelOpen) {
      samplePanelOpen = true;
    }
  }

  function loadSampleDiagram(sampleCode) {
    code = sampleCode;
    isDataLoaded = true;
    console.log(`Loaded sample diagram`);
  }

  const sizeOptions = [
    { value: 'xs', label: 'Extra Small' },
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'xl', label: 'Extra Large' }
  ];


  function handleThemeSelect(selectedTheme) {
    theme = selectedTheme;
    showThemeDropdown = false;
  }

  function handleThemeDropdownClick(event) {
    event.stopPropagation(); 
    showThemeDropdown = !showThemeDropdown;

    if (themeButtonRef) {
      const rect = themeButtonRef.getBoundingClientRect();
      themeDropdownPosition = {
        top: `${rect.bottom + 8}px`,
        right: `${window.innerWidth - rect.right}px`
      };
    }
  }
</script>

<div class="flex h-full flex-col overflow-hidden">
  <nav class="z-50 flex p-4 sm:p-6">
    <div class="flex flex-1 items-center gap-4">
      <div class="flex items-center gap-2  gap-[8px]">
        <div class="flex items-center gap-2">
          <img 
            src="https://static.mermaidchart.dev/assets/mermaid-icon.svg" 
            alt="Mermaid icon"
            style="width: 32px; height: 32px; padding: 12px;"
          />
          <button 
            class="confluence-back-text"
            on:click={() => window.AP?.confluence?.closeMacroEditor()}
            style="
              font-family: 'Recursive';
              font-weight: 600;
              font-size: 16px;
              line-height: 20px;
              letter-spacing: 0%;
              color: var(--Color-Coast-Blue-500, rgba(65, 135, 153, 1));
              cursor: pointer;
              transition: opacity 0.2s;
              background: none;
              border: none;
              padding: 0;
            "
            on:mouseenter={(e) => e.target.style.opacity = '0.8'}
            on:mouseleave={(e) => e.target.style.opacity = '1'}
            type="button"
            aria-label="Navigate back to Confluence"
          >
            Confluence
          </button>
        </div>
        <span>/</span>
        <span class="text-[var(--Color-Deep-Purple-800,rgba(30,26,46,1))] " style="font-size: 16px; font-family: 'Recursive';">Editor</span>
      </div>
    </div>
    
    <div class="flex items-center gap-4 mr-[24px] gap-[12px]">
  {#if !renderError}
    <input
      type="text"
      bind:value={caption}
      placeholder="Enter diagram caption"
      class="text-sm focus:outline-none"
      style="width: 200px; height: 32px; padding-top: 4px; padding-bottom: 4px; padding-left: 12px; padding-right: 12px; border-width: 2px; border-color: #c0dce1; border-style: solid; border-radius: 12px; font-family: 'Recursive';"
    />
    <Select
      bind:value={size}
      options={sizeOptions}
      width="120px"
      on:change={(e) => size = e.detail.value}
      class="focus:outline-none"
    />
    <button
      class="btn h-[42px] gap-1 border text-sm font-medium flex items-center justify-center px-4 py-2 rounded-[12px]
        {!(isRendering || error)
          ? 'border-mermaid-pink-500 text-white hover:bg-mermaid-pink-600'
          : 'cursor-not-allowed border-surface-300 bg-surface-100 text-surface-400'}"
      style={!(isRendering || error)
        ? 'background: var(--Color-Mermaid-Pink-500, rgba(224, 9, 95, 1));'
        : ''}
      on:click={handleInsert}
      disabled={isRendering || !!error}
    >
      Insert diagram
    </button>
  {/if}

    </div>
    {#if error}
      <div class="mt-2 rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-600">
        {error}
      </div>
    {/if}
  </nav>
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="flex-1 overflow-hidden">
      <div class="flex h-full gap-4 p-2 pt-0 pl-6 sm:gap-0 sm:p-6 sm:pt-0">
        <!-- Left panel - Editor and Sample Diagrams (30% width like mermaid-live-editor) -->
        <div class="flex w-[30%] min-w-0 flex-col gap-[16px] sm:gap-6 pb-[24px] pl-[24px]">
  <!-- Code editor card -->
          <Card
            title="Code"
            isOpen={true}
            isClosable={false}
            tabs={editorTabs}
            activeTabID={editorMode}
            icon={CodeSvgIcon}
          >
            <div slot="actions" class="relative">
              <button
                bind:this={themeButtonRef}
                class="flex items-center justify-center size-[32px] bg-[#DCEEF1] border-0 p-[0] rounded-md shadow-sm focus:outline-none"
                on:click={handleThemeDropdownClick}
                title="Change theme"
              >
                <PaletteIcon class="w-4 h-4" />
              </button>
            </div>

            <div class="h-full p-2">
              <Editor bind:this={editorComponent} onUpdate={handleCodeChange} value={code} error={renderError} />
            </div>
          </Card>
          {#if showThemeDropdown}
          <div class="fixed z-50" style="top: {themeDropdownPosition.top}; right: {themeDropdownPosition.right};">
            <div class="card rounded-2xl border-2 shadow-lg bg-[#DCEEF1] border border-2 border-[#BEDDE3] overflow-hidden">
              <div class="p-[8px] w-[180px] leading-[24px] text-sm font-medium text-[#5F5D7A]">
                Themes
              </div>
              <div class="flex flex-col p-1">
                {#each MERMAID_THEMES as themeOption}
                  <button
                    on:click={() => handleThemeSelect(themeOption.id)}
                    class="flex items-center justify-between rounded-none font-normal leading-[24px] text-sm p-[8px] text-left transition-colors unselected-theme bg-[#F1F8FA] border border-[#ddedf0]"
                  >
                    {themeOption.name}
                    {#if theme === themeOption.id}
                      <span class="text-[#5F5D7A]">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          </div>
          {/if}
          <div class="group flex flex-wrap justify-between gap-4 sm:gap-6">
            <Preset onLoadSample={loadSampleDiagram} isOpen={samplePanelOpen} />
          </div>
        </div>
        <div class="flex h-full flex-1 min-w-0 flex-col overflow-hidden pl-4 sm:pl-6">
          <View {code} {theme} onError={handleRenderError} shouldShowGrid={true} />
        </div>
      </div>
    </div>
  </div>
</div>
{#if showThemeDropdown}
  <div 
    class="fixed inset-0 z-10" 
    on:click={() => showThemeDropdown = false}
    on:keydown={(e) => e.key === 'Escape' && (showThemeDropdown = false)}
    role="button"
    tabindex="0"
    aria-label="Close theme dropdown">
  </div>
{/if}

