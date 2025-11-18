<script>
  import { fade } from 'svelte/transition';

  export let tabs = [];
  export let activeTabID = '';
  export let onselect = null;

  if (!activeTabID && tabs.length > 0) {
    activeTabID = tabs[0].id;
  }

  const toggleTabs = (tab) => {
    return (event) => {
      event.stopPropagation();
      onselect?.(tab);
    };
  };
</script>

<div class="flex w-fit cursor-default items-center gap-2">
  <ul class="flex gap-2 align-middle m-0" transition:fade>
    {#each tabs as tab, index}
    <div
      role="tab"
      tabindex="0"
      class="text-sm font-normal cursor-pointer text-[var(--Color-Deep-Purple-800)]"
      on:click={() => toggleTabs(tab)}
      on:keypress={() => toggleTabs(tab)}
    >
      {#if tab.icon}
        <svelte:component this={tab.icon} class="inline h-4 w-4 mr-1" />
      {/if}
      {tab.title}
    </div>

    {#if index < tabs.length - 1}
      <div class="mx-2 text-[var(--Color-Deep-Purple-800)]">|</div>
    {/if}
  {/each}
  </ul>
</div>
