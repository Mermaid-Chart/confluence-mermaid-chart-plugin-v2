<script>
  import DesktopEditor from './DesktopEditor.svelte';
  import ExclamationCircleIcon from '~icons/material-symbols/error-outline-rounded';

  export let onUpdate = () => {};
  export let value = '';
  export let error = null; 

  $: if (error) {
    console.log('Editor component received error:', error);
  }

  let editorComponent;

  export const setValue = (newValue) => {
    value = newValue;
    editorComponent?.setValue?.(newValue);
  };

  export const getValue = () => {
    return editorComponent?.getValue?.() || value;
  };
</script>

<div class="flex h-full flex-col">
  <div class="flex-1 overflow-hidden">
      <DesktopEditor bind:this={editorComponent} {onUpdate} {value} />
  </div>
  
{#if error}
 <div class="flex flex-col text-sm overflow-auto h-36">
    <!-- Header -->
<div class="flex items-center justify-between gap-8 bg-[#e9eaf9] p-[16px] overflow-auto text-[#332a54] rounded-t-[8px]">
  <div class="flex items-center gap-[8px]  p-4">
    <ExclamationCircleIcon class="size-5 text-[#332a54]" aria-hidden="true" />
    <span class="font-medium text-[#332a54]">Syntax error</span>
  </div>
</div>

    <output
      class="h-[184px] overflow-auto bg-[#ffffff] pl-[12px]"
      name="mermaid-error"
      for="editor"
    >
      <pre class="whitespace-pre-wrap text-xs text-gray-800 font-mono">{error}</pre>
    </output>
  </div>
{/if}


</div>
