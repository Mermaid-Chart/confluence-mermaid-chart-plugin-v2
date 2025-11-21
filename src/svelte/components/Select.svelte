<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let value = '';
  export let options = [];
  export let placeholder = 'Select an option';
  export let disabled = false;
  export let width = '120px';


  let isOpen = false;
  let selectRef;
  let dropdownRef;
  
  const dispatch = createEventDispatcher();
  
  $: selectedOption = options.find(opt => opt.value === value) || null;
  
  function toggleDropdown() {
    if (disabled) {
      return;
    }
    isOpen = !isOpen;
  }
  
  function selectOption(option) {
    value = option.value;
    isOpen = false;
    dispatch('change', { value: option.value, option });
  }
  
  function cn(...classes) {
    return classes.filter(Boolean).join(' ');
  }
  
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      isOpen = false;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        isOpen = true;
      } else {
        const currentIndex = options.findIndex(opt => opt.value === value);
        let newIndex;
        
        if (event.key === 'ArrowDown') {
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        }
        
        if (options[newIndex]) {
          selectOption(options[newIndex]);
        }
      }
    }
  }
  
  function handleClickOutside(event) {
    if (selectRef && !selectRef.contains(event.target)) {
      isOpen = false;
    }
  }
  
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div 
  bind:this={selectRef}
  class="relative inline-block "
  style="width: {width};"
>
  <button
    type="button"
    class="select-button"
    class:disabled
    on:click={toggleDropdown}
    on:keydown={handleKeydown}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
  >
    <span class="block truncate text-left">
      {selectedOption ? selectedOption.label : placeholder}
    </span>
    <svg 
      class="dropdown-arrow"
      class:open={isOpen}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  {#if isOpen}
    <div
      bind:this={dropdownRef}
      class="dropdown-menu"
      role="listbox"
    >
      {#each options as option, index}
        <button
          type="button"
          class="dropdown-option"
          class:selected={option.value === value}
          on:click={() => selectOption(option)}
          role="option"
          aria-selected={option.value === value}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select-button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 42px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: normal;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    border-radius: 12px;
    border-width: 2px;
    font-family: 'Recursive';
    border-color: #c0dce1
  }

  .select-button:hover {
    background-color: #DCEEF1;
    border-color: #9ca3af;
  }

  .select-button:focus {
    outline: none;
    border-color: #BEDDE3;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .select-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-arrow {
    width: 12px;
    height: 12px;
    min-width: 12px;
    color: #6b7280;
    transition: transform 0.2s ease-in-out;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    z-index: 50;
    margin-top: 4px;
    width: 100%;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    max-height: 240px;
    overflow-y: auto;
    font-family: 'Recursive';
  }

  .dropdown-option {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: normal;
    color: #374151;
    background: #F1F8FA;
    border: 1px solid #ddedf0;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
  }

  .dropdown-option:hover {
    background-color: #c0dce1;
  }

  .dropdown-option.selected {
    background-color: #F1F8FA;
    font-weight: 500;
  }

  /* Custom scrollbar */
  .dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }
  
  .dropdown-menu::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  .dropdown-menu::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  .dropdown-menu::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
</style>
