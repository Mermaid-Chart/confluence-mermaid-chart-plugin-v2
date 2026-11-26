<script>
  import { quintOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import Tabs from './Tabs.svelte';

  export let isClosable = true;
  export let isOpen = false;
  export let isStackable = false;
  export let tabs = [];
  export let activeTabID = '';
  export let title = '';
  export let icon = null;
  export let onselect = null;

  const toggleCardOpen = () => {
    if (isClosable) {
      isOpen = !isOpen;
    }
  };

  $: isTabsShown = isOpen && tabs.length > 0;
</script>

<div
  class="card flex  flex-col overflow-hidden  border-2 border-muted {isOpen ? 'isOpen' : ''} {isStackable ? 'flex-1 group-has-[.isOpen]:w-full group-has-[.isOpen]:flex-none' : 'w-full'}"
>
  <div
    role="toolbar"
    tabindex="0"
    class="flex h-11 gap-2 flex-none cursor-pointer items-center justify-between whitespace-nowrap bg-[#F1F8FA] p-[12px] {isTabsShown ? 'pb-1' : ''}"
    on:click={toggleCardOpen}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleCardOpen();
      }
    }}
  >
    {#if icon || title}
      <span role="menubar" tabindex="0" class="flex w-fit items-center gap-[8px] "  style="font-family: 'Recursive'">
        {#if icon}
          <svelte:component this={icon} class="h-[24px] w-[24px]" />
        {/if}
        {title}
      </span>
    {/if}
    
    {#if isOpen && tabs && tabs.length > 0}
      <Tabs {onselect} {tabs} {activeTabID} />
    {/if}

    <slot name="actions" />
  </div>
  
  {#if isOpen}
    <div class="flex-grow overflow-hidden flex flex-col" transition:slide={{ easing: quintOut }}>
      <slot />
    </div>
  {/if}
</div>
